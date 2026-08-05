import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ROLE, type Role } from '@qlhs/contracts'
import { UserRoleRepo } from '../prisma/users/user-role.repo'
import { DigestOutboxRepo } from '../prisma/notify/digest-outbox.repo'
import { SystemClock } from '../clock/system-clock'
import { isBusinessDay } from '../../domain/sla/business-days'
import { BuildDigestUseCase } from '../../application/notify/build-digest.usecase'

/** Only the roles that actually process files inside QLHS. Andy/ACC/BOP are
 *  EXTERNAL actors who never log in (role.ts), and an Applicant already gets a
 *  per-event email — mailing either would be pure noise. */
const DIGEST_ROLES: readonly Role[] = [ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3]

/**
 * F11 — queues the 9h00 morning digest on working days (Vietnam time, fixed).
 *
 * Two independent guards keep this from becoming spam: `buildDigest` returns
 * null when the person has nothing pressing (so no row is written at all), and
 * the outbox's UNIQUE (recipient, date) caps it at one email per person per day
 * even if the scheduler runs twice.
 */
@Injectable()
export class DigestScheduler {
  private readonly log = new Logger(DigestScheduler.name)

  constructor(
    private readonly userRoles: UserRoleRepo,
    private readonly outbox: DigestOutboxRepo,
    private readonly build: BuildDigestUseCase,
    private readonly clock: SystemClock,
  ) {}

  @Cron('0 0 9 * * 1-5', { timeZone: 'Asia/Ho_Chi_Minh' })
  scheduled(): Promise<number> {
    if (process.env.QLHS_DISABLE_CRON === '1') return Promise.resolve(0)
    return this.scan().catch((e) => {
      this.log.error(`digest scan failed: ${String(e)}`)
      return 0
    })
  }

  /** Queue a digest for everyone who needs one today. Returns how many queued. */
  async scan(): Promise<number> {
    const now = this.clock.now()
    if (!isBusinessDay(now)) return 0
    const users = await this.userRoles.listDigestRecipients(DIGEST_ROLES)
    let queued = 0
    for (const u of users) {
      const digest = await this.build.execute(u.sub, u.roles, now)
      if (!digest) continue // nothing pressing → stay silent, write no row
      queued += await this.outbox.enqueue(u.sub, now)
    }
    return queued
  }
}
