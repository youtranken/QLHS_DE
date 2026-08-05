import type { Prisma } from '@prisma/client'
import type { TicketStatus } from '@qlhs/contracts'
import { emailIntentKind } from '../../../domain/notify/email-intent'

/**
 * Write the Applicant email intent for a just-committed transition, IF the AD-15
 * matrix asks for one (Completed / Returned → yes; Payment's Sent to Accounting →
 * no, H5). Called INSIDE the transition's transaction so a rollback drops the
 * intent too (no ghost email, AC3). Idempotent via the UNIQUE (ticket, round,
 * kind) index → ON CONFLICT DO NOTHING (a retried/duplicated write is a no-op).
 */
export async function writeEmailIntent(
  tx: Prisma.TransactionClient,
  args: { ticketId: string; toStatus: string; roundNo: number; recipientSub: string },
): Promise<void> {
  const kind = emailIntentKind(args.toStatus as TicketStatus)
  if (!kind) return
  await tx.$executeRaw`
    INSERT INTO notification_outbox (ticket_id, round_no, kind, recipient_sub, status)
    VALUES (${args.ticketId}, ${args.roundNo}, ${kind}, ${args.recipientSub}, 'pending')
    ON CONFLICT (ticket_id, round_no, kind) DO NOTHING`
}
