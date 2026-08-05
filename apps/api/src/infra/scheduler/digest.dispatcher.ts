import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { ROLE, type Role } from '@qlhs/contracts'
import { MailPort } from '../../domain/ports/mail.port'
import { DigestOutboxRepo } from '../prisma/notify/digest-outbox.repo'
import { UserRoleRepo } from '../prisma/users/user-role.repo'
import { SystemClock } from '../clock/system-clock'
import { digestTemplate } from '../../domain/notify/digest-template'
import { BuildDigestUseCase } from '../../application/notify/build-digest.usecase'

const MAX_ATTEMPTS = 8
const BASE_BACKOFF_SECS = 30
const CAP_BACKOFF_SECS = 1800
const BATCH = 20
const DIGEST_ROLES: readonly Role[] = [ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3]

/**
 * F11 dispatcher. Mirrors the ticket outbox (send OUTSIDE any transaction, then
 * mark that row alone) but rebuilds the digest AT SEND TIME rather than storing
 * a rendered body: if the person cleared their queue between 7h30 and delivery,
 * the row is dropped instead of mailing a picture that is already wrong.
 */
@Injectable()
export class DigestDispatcher {
  private readonly log = new Logger(DigestDispatcher.name)
  private running = false

  constructor(
    private readonly outbox: DigestOutboxRepo,
    private readonly userRoles: UserRoleRepo,
    private readonly build: BuildDigestUseCase,
    private readonly mail: MailPort,
    private readonly clock: SystemClock,
  ) {}

  @Interval('digest-dispatch', 60_000)
  scheduled(): Promise<number> {
    if (process.env.QLHS_DISABLE_CRON === '1') return Promise.resolve(0)
    return this.dispatch().catch((e) => {
      this.log.error(`digest dispatch failed: ${String(e)}`)
      return 0
    })
  }

  async dispatch(): Promise<number> {
    if (this.running) return 0
    this.running = true
    try {
      const rows = await this.outbox.due(BATCH)
      if (rows.length === 0) return 0
      const now = this.clock.now()
      const recipients = new Map(
        (await this.userRoles.listDigestRecipients(DIGEST_ROLES)).map((r) => [r.sub, r]),
      )
      let sent = 0
      for (const row of rows) {
        const who = recipients.get(row.recipientSub)
        // Opted out (or lost the role) between queueing and sending — drop it.
        if (!who) {
          await this.outbox.markSkipped(row.id, 'no longer a digest recipient')
          continue
        }
        const digest = await this.build.execute(who.sub, who.roles, now)
        if (!digest) {
          await this.outbox.markSkipped(row.id, 'nothing left to report')
          continue
        }
        try {
          const { subject, body } = digestTemplate({ digest, name: who.name, date: row.digestDate })
          await this.mail.send({ to: who.email, subject, body })
        } catch (e) {
          await this.outbox.bumpRetry(row.id, String(e), MAX_ATTEMPTS, BASE_BACKOFF_SECS, CAP_BACKOFF_SECS)
          continue
        }
        // Outside the send try/catch: if the mail went out but the bookkeeping
        // fails, retrying would mail the same person a second time.
        await this.outbox.markSent(row.id)
        sent++
      }
      return sent
    } finally {
      this.running = false
    }
  }
}
