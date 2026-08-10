import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { TICKET_STATUS } from '@qlhs/contracts'
import { PrismaService } from '../prisma/prisma.service'
import { MailPort } from '../../domain/ports/mail.port'
import { emailTemplate, NOTIFICATION_KIND } from '../../domain/notify/email-template'

interface PendingRow {
  id: bigint
  kind: string
  round_no: number
  code: string | null
  ticket_status: string
  ticket_round: number
  email: string | null
}

// A transient SMTP/directory outage must not lose a notification: retry with
// exponential backoff (15s → capped 30m) across many attempts so an outage of
// hours still recovers, and only park 'failed' after the whole window is spent.
const MAX_ATTEMPTS = 12
const BASE_BACKOFF_SECS = 15
const CAP_BACKOFF_SECS = 1800
const BATCH = 20

/**
 * Outbox dispatcher (AD-15/M4): post-commit, at-least-once, idempotent.
 *
 * The SMTP send happens OUTSIDE any DB transaction (code-review #1): a batch is
 * read, each mail is sent, then that row alone is marked `sent`. Coupling the send
 * to a transaction would let Prisma's 5s interactive-tx cap roll back a `sent`
 * mark AFTER the mail already left the server → duplicate emails. An in-flight
 * guard stops a 15s tick from overlapping a slow run (single-instance on-prem; a
 * multi-instance deploy would additionally need a row-claim, e.g. SKIP LOCKED).
 *
 * `return_reminder` is re-validated at send: skipped unless the ticket is STILL at
 * `Return-fixing` AND at the SAME round the reminder was queued for (a stale
 * prior-round reminder must not fire, code-review #3). A missing recipient email
 * is transient (the directory cache fills on the user's next login), so it retries
 * like an SMTP failure rather than parking as a permanent `failed` (code-review #2).
 */
@Injectable()
export class OutboxDispatcher {
  private readonly log = new Logger(OutboxDispatcher.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailPort,
  ) {}

  @Interval('outbox-dispatch', 15_000)
  scheduled(): Promise<number> {
    if (process.env.QLHS_DISABLE_CRON === '1') return Promise.resolve(0)
    return this.dispatch().catch((e) => {
      this.log.error(`dispatch failed: ${String(e)}`)
      return 0
    })
  }

  /** Process one batch of pending intents. Returns how many emails were sent. */
  async dispatch(): Promise<number> {
    if (this.running) return 0 // don't let a 15s tick overlap a slow run
    this.running = true
    try {
      const rows = await this.prisma.$queryRaw<PendingRow[]>`
        SELECT o.id, o.kind, o.round_no, t.code, t.status AS ticket_status,
               t.round_no AS ticket_round, u.email
        FROM notification_outbox o
        JOIN "ticket" t ON t.id = o.ticket_id
        LEFT JOIN "user" u ON u.sub = o.recipient_sub
        WHERE o.status = 'pending'
          AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= now())
        ORDER BY o.created_at
        LIMIT ${BATCH}`
      let sent = 0
      for (const r of rows) {
        if (this.isStaleReminder(r)) {
          await this.markSkipped(r.id)
          continue
        }
        if (!r.email) {
          await this.bumpRetry(r.id, 'no recipient email')
          continue
        }
        try {
          const { subject, body, html } = emailTemplate({ kind: r.kind, code: r.code })
          await this.mail.send({ to: r.email, subject, body, html }) // OUTSIDE any tx
          await this.prisma
            .$executeRaw`UPDATE notification_outbox SET status='sent', sent_at=now() WHERE id=${r.id}`
          sent++
        } catch (e) {
          await this.bumpRetry(r.id, String(e))
        }
      }
      return sent
    } finally {
      this.running = false
    }
  }

  /** A reminder is stale unless the ticket is still Return-fixing at the SAME round. */
  private isStaleReminder(r: PendingRow): boolean {
    return (
      r.kind === NOTIFICATION_KIND.ReturnReminder &&
      (r.ticket_status !== TICKET_STATUS.ReturnFixing || r.round_no !== r.ticket_round)
    )
  }

  private markSkipped(id: bigint): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE notification_outbox SET status='sent', sent_at=now(),
             last_error='skipped: stale reminder' WHERE id=${id}`
  }

  /** Stay retryable (a transient send/lookup failure) with exponential backoff
   *  until MAX_ATTEMPTS, then park 'failed'. `attempts` here is the pre-increment
   *  count, so the first failure backs off BASE_BACKOFF_SECS. */
  private bumpRetry(id: bigint, error: string): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE notification_outbox
      SET status = CASE WHEN attempts + 1 >= ${MAX_ATTEMPTS} THEN 'failed' ELSE 'pending' END,
          attempts = attempts + 1, last_error = ${error},
          next_attempt_at = now() + make_interval(secs =>
            LEAST(${CAP_BACKOFF_SECS}::int, (${BASE_BACKOFF_SECS}::int * power(2, attempts))::int))
      WHERE id = ${id}`
  }
}
