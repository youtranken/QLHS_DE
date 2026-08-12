import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { TICKET_EVENT } from '@qlhs/contracts'

// `reason` lands in the append-only `ticket_event` (AD-4) — immutable, so an
// oversized note can never be trimmed. Bound it at the edge like every other
// free-text field. `BATCH_MAX` caps how many tickets one batch call may fan into
// concurrent FOR-UPDATE transitions, so a lone caller can't exhaust the DB pool.
const REASON_MAX = 500
export const BATCH_MAX = 100

/**
 * The ONLY events the generic DCC1 action endpoint may fire — each is a single,
 * self-contained transition. `reopen` (must chain reopen→sendBack atomically) and
 * `undo` (compensating) have DEDICATED endpoints; admitting them here would let a
 * lone `reopen` strand a ticket at the transient `Reopened` status. Applicant-only
 * events (confirmReturnReceipt/resubmit/cancel) and audit-only notes are excluded.
 *
 * `submitToAndy` is DELIBERATELY excluded: Submitted→Andy must go through
 * /dcc1/pool/:id/confirm, which mints the ticket code (AD-5) and honours the
 * soft-lock. Raw transition() does neither, so a generic submitToAndy would push
 * a code-less ticket all the way to Completed (breaking dedup/search/notify).
 */
const GENERIC_ACTION_EVENTS: string[] = [
  TICKET_EVENT.AndyApproveComplete,
  TICKET_EVENT.AndyRequireBop,
  TICKET_EVENT.BopApprove,
  TICKET_EVENT.SendBack,
  TICKET_EVENT.HandoverToDcc2,
  TICKET_EVENT.HandoverToDcc3,
  TICKET_EVENT.SubmitToBop,
  // Bulk "Nhận về từ ACC": a self-contained DCC1 transition. The dedicated
  // per-ticket endpoint additionally records the receipt DATE; the bulk path takes
  // the transition's `now` (a stack received today), which is the sensible default.
  TICKET_EVENT.ReceiveFromAcc,
]

export class TicketActionDto {
  @IsIn(GENERIC_ACTION_EVENTS)
  event!: string

  @IsOptional()
  @IsString()
  @MaxLength(REASON_MAX)
  reason?: string
}

/** For endpoints whose event is fixed by the route (e.g. reopen) — reason only. */
export class ReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(REASON_MAX)
  reason?: string
}

/** A dated hardcopy-receipt confirmation (defaults to today when omitted). */
export class ReceiveDateDto {
  @IsOptional()
  @IsDateString()
  receivedAt?: string
}

export class BatchActionDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(BATCH_MAX)
  @IsString({ each: true })
  ticketIds!: string[]

  @IsIn(GENERIC_ACTION_EVENTS)
  event!: string

  @IsOptional()
  @IsString()
  @MaxLength(REASON_MAX)
  reason?: string
}

/** DCC2 hardcopy bulk (Contract close): confirm receipt of many hardcopies, or
 *  complete many at once. Both route through the real per-ticket use cases (email
 *  intent + reconcile guard), never a raw batch transition. */
export const DCC2_BATCH_EVENTS: string[] = [
  TICKET_EVENT.ConfirmReceivedByDcc2,
  TICKET_EVENT.CompleteContract,
]

export class Dcc2BatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(BATCH_MAX)
  @IsString({ each: true })
  ticketIds!: string[]

  @IsIn(DCC2_BATCH_EVENTS)
  event!: string
}
