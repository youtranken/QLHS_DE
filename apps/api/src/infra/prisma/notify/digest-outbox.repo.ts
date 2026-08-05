import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export interface DueDigest {
  id: bigint
  recipientSub: string
  digestDate: Date
}

/** F11 outbox: one row per (person, day) that owes a digest. */
@Injectable()
export class DigestOutboxRepo {
  constructor(private readonly prisma: PrismaService) {}

  /** Queue a digest. The UNIQUE (recipient, date) makes a re-run a no-op, so the
   *  scheduler can fire twice without ever mailing twice. */
  enqueue(recipientSub: string, digestDate: Date): Promise<number> {
    return this.prisma.$executeRaw`
      INSERT INTO digest_outbox (recipient_sub, digest_date, status)
      VALUES (${recipientSub}, ${digestDate}::date, 'pending')
      ON CONFLICT (recipient_sub, digest_date) DO NOTHING`
  }

  /**
   * Claims rows for THIS dispatcher: `FOR UPDATE SKIP LOCKED` + a flip to
   * 'sending' in one statement. Without the claim, two API processes both read
   * the same pending row and both mail it — the UNIQUE (recipient, date) index
   * de-duplicates rows, never sends.
   */
  due(limit: number): Promise<DueDigest[]> {
    return this.prisma.$queryRaw<DueDigest[]>`
      UPDATE digest_outbox
         SET status = 'sending', next_attempt_at = now() + interval '10 minutes'
      WHERE id IN (
        SELECT id FROM digest_outbox
        WHERE (status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
           -- Lease expired: whoever claimed this died mid-send. Take it back
           -- rather than leaving the row stuck in 'sending' forever.
           OR (status = 'sending' AND next_attempt_at <= now())
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, recipient_sub AS "recipientSub", digest_date AS "digestDate"`
  }

  markSent(id: bigint): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE digest_outbox SET status='sent', sent_at=now() WHERE id=${id}`
  }

  /** Nothing was mailed and nothing will be — kept distinct from 'sent' so a
   *  "how many digests went out?" query is not quietly wrong. */
  markSkipped(id: bigint, why: string): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE digest_outbox SET status='skipped', sent_at=now(), last_error=${why}
      WHERE id=${id}`
  }

  /** Stay retryable with exponential backoff, then park 'failed' (mirrors the
   *  ticket outbox: a transient SMTP outage must not lose the morning mail). */
  bumpRetry(id: bigint, error: string, maxAttempts: number, baseSecs: number, capSecs: number): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE digest_outbox
      SET status = CASE WHEN attempts + 1 >= ${maxAttempts} THEN 'failed' ELSE 'pending' END,
          attempts = attempts + 1, last_error = ${error},
          next_attempt_at = now() + make_interval(secs =>
            LEAST(${capSecs}::int, (${baseSecs}::int * power(2, attempts))::int))
      WHERE id = ${id}`
  }
}
