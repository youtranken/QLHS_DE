import { FLOW, ROLE, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import type { Edge } from './types'

/**
 * Luồng A — General (PRD §4.2). DCC1 owns the whole line; no DCC2/3, no scan.
 * SLA is measured on the "from" state via sla_config; Completed is terminal
 * (no badge).
 */
export const GENERAL_EDGES: readonly Edge[] = [
  {
    from: TICKET_STATUS.SubmittedToVpAndy,
    event: TICKET_EVENT.AndyApproveComplete,
    to: TICKET_STATUS.Completed,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.General,
    reversible: false,
  },
  {
    from: TICKET_STATUS.SubmittedToVpAndy,
    event: TICKET_EVENT.AndyRequireBop,
    to: TICKET_STATUS.SubmittedToBop,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.General,
    reversible: true,
  },
  {
    from: TICKET_STATUS.SubmittedToBop,
    event: TICKET_EVENT.BopApprove,
    to: TICKET_STATUS.Completed,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.General,
    reversible: false,
  },
  {
    from: TICKET_STATUS.SubmittedToBop,
    event: TICKET_EVENT.SendBack,
    to: TICKET_STATUS.Returned,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.General,
    reversible: false,
  },
]
