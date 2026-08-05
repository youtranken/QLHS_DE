import { ROLE, TICKET_STATUS, type Role, type TicketStatus } from '@qlhs/contracts'

/** The board columns (stations) a role acts on. Contract/Payment columns fill
 *  with cards as Epic 3/4 lands; DCC1 owns the General line + Pool. */
export function stationsForRole(role: Role | null): TicketStatus[] {
  switch (role) {
    case ROLE.Dcc1:
    case ROLE.Admin:
      return [
        TICKET_STATUS.Submitted,
        TICKET_STATUS.SubmittedToVpAndy,
        TICKET_STATUS.SubmittedToAccounting, // "Chờ ACC" — DCC1 receives back (AD-16)
        TICKET_STATUS.ReceivedFromAcc,
        TICKET_STATUS.SubmittedToBop,
      ]
    case ROLE.Dcc2:
      return [
        TICKET_STATUS.SubmittedToDcc2,
        TICKET_STATUS.ReceivedByDcc2,
        TICKET_STATUS.SubmittedToAccounting, // read-only mirror of the ACC step
        TICKET_STATUS.SubmittedToDcc2Hardcopy,
        TICKET_STATUS.Hardcopy,
      ]
    case ROLE.Dcc3:
      return [TICKET_STATUS.SubmittedToDcc3, TICKET_STATUS.ReceivedByDcc3]
    default:
      return []
  }
}
