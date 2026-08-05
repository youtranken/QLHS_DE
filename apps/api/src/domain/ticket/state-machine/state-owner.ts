import { ROLE, TICKET_STATUS, type Role, type TicketStatus } from '@qlhs/contracts'

/**
 * Who owns a ticket while it sits in a given status. `current_holder_sub` is
 * DERIVED from the to-status (AD-2) — never a UI-set flag. `null` = an
 * unassigned pool/queue or a terminal (closed) status.
 */
const OWNER: Partial<Record<TicketStatus, Role | null>> = {
  [TICKET_STATUS.Submitted]: null, // Pool — any DCC1
  [TICKET_STATUS.SubmittedToVpAndy]: ROLE.Dcc1,
  [TICKET_STATUS.SubmittedToBop]: ROLE.Dcc1,
  [TICKET_STATUS.Returned]: ROLE.Applicant,
  [TICKET_STATUS.ReturnFixing]: ROLE.Applicant,
  [TICKET_STATUS.Reopened]: ROLE.Dcc1,
  // Contract/Payment states — owners known now so holder derivation is stable
  // when Epic 3/4 add the edges.
  [TICKET_STATUS.SubmittedToDcc2]: ROLE.Dcc2,
  [TICKET_STATUS.ReceivedByDcc2]: ROLE.Dcc2,
  [TICKET_STATUS.SubmittedToDcc3]: ROLE.Dcc3,
  [TICKET_STATUS.ReceivedByDcc3]: ROLE.Dcc3,
  [TICKET_STATUS.SubmittedToAccounting]: ROLE.Dcc1,
  [TICKET_STATUS.ReceivedFromAcc]: ROLE.Dcc1,
  [TICKET_STATUS.SubmittedToDcc2Hardcopy]: ROLE.Dcc2,
  [TICKET_STATUS.Hardcopy]: ROLE.Dcc2,
}

export function stateOwner(status: TicketStatus): Role | null {
  return OWNER[status] ?? null
}
