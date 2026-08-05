import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'
import { TicketNotFoundError } from '../../../domain/errors'
import {
  LOCK_TTL_MS,
  type AcquireResult,
  type LockPort,
  type TicketLock,
} from '../../../domain/lock/lock'

type Db = PrismaService | Prisma.TransactionClient

interface LockRow {
  holder_sub: string
  expires_at: Date
}

/**
 * Soft-lock persistence (AD-9/AD-14). Acquire/seize is one conditional upsert:
 * the UNIQUE ticket_id serializes concurrent callers and the ON CONFLICT WHERE
 * only lets a caller take the lock when it is free, expired, or already theirs —
 * so exactly one of two racers wins.
 */
@Injectable()
export class LockRepo implements LockPort {
  constructor(private readonly prisma: PrismaService) {}

  async get(ticketId: string): Promise<TicketLock | null> {
    const row = await this.prisma.ticketLock.findUnique({ where: { ticketId } })
    if (!row) return null
    return {
      ticketId: row.ticketId,
      holderSub: row.holderSub,
      acquiredAt: row.acquiredAt,
      expiresAt: row.expiresAt,
    }
  }

  acquireOrSeize(ticketId: string, holderSub: string, now: Date): Promise<AcquireResult> {
    return this.upsert(this.prisma, ticketId, holderSub, now)
  }

  /** Pick a Pool ticket: only when Submitted + lock is free; audits pool_picked. */
  async pickFromPool(
    ticketId: string,
    holderSub: string,
    now: Date,
  ): Promise<{ picked: boolean; heldBy?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: { status: true, roundNo: true },
      })
      if (!ticket) throw new TicketNotFoundError(ticketId)
      if (ticket.status !== TICKET_STATUS.Submitted) return { picked: false }

      const res = await this.upsert(tx, ticketId, holderSub, now)
      if (!res.acquired) return { picked: false, heldBy: res.holderSub }

      await tx.ticketEvent.create({
        data: {
          ticketId,
          actorSub: holderSub,
          action: TICKET_EVENT.PoolPicked,
          fromStatus: TICKET_STATUS.Submitted,
          toStatus: TICKET_STATUS.Submitted,
          roundNo: ticket.roundNo,
          occurredAt: now,
        },
      })
      return { picked: true, heldBy: holderSub }
    })
  }

  /** Seize (take over an expired/other lock); audits lock_seized when it changes hands. */
  async seize(
    ticketId: string,
    holderSub: string,
    now: Date,
  ): Promise<AcquireResult & { seized: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const prev = await tx.ticketLock.findUnique({ where: { ticketId } })
      const res = await this.upsert(tx, ticketId, holderSub, now)
      const seized = res.acquired && prev !== null && prev.holderSub !== holderSub
      if (seized) {
        const ticket = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: { status: true, roundNo: true },
        })
        if (ticket) {
          await tx.ticketEvent.create({
            data: {
              ticketId,
              actorSub: holderSub,
              action: TICKET_EVENT.LockSeized,
              fromStatus: ticket.status,
              toStatus: ticket.status,
              roundNo: ticket.roundNo,
              occurredAt: now,
              meta: { from: prev.holderSub },
            },
          })
        }
      }
      return { ...res, seized }
    })
  }

  private async upsert(
    db: Db,
    ticketId: string,
    holderSub: string,
    now: Date,
  ): Promise<AcquireResult> {
    const expiresAt = new Date(now.getTime() + LOCK_TTL_MS)
    const rows = await db.$queryRaw<LockRow[]>`
      INSERT INTO ticket_lock (ticket_id, holder_sub, acquired_at, expires_at)
      VALUES (${ticketId}, ${holderSub}, ${now}, ${expiresAt})
      ON CONFLICT (ticket_id) DO UPDATE
        SET holder_sub = EXCLUDED.holder_sub,
            acquired_at = EXCLUDED.acquired_at,
            expires_at = EXCLUDED.expires_at
        WHERE ticket_lock.expires_at <= ${now} OR ticket_lock.holder_sub = ${holderSub}
      RETURNING holder_sub, expires_at`
    const acquired = rows[0]
    if (acquired) {
      return { acquired: true, holderSub: acquired.holder_sub, expiresAt: acquired.expires_at }
    }
    const current = await db.ticketLock.findUnique({ where: { ticketId } })
    return {
      acquired: false,
      holderSub: current?.holderSub ?? holderSub,
      expiresAt: current?.expiresAt ?? now,
    }
  }
}
