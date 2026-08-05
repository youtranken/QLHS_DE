/**
 * Processing flows (B1). Full names — NEVER 'A'|'B'|'C'. `mapFlow(documentType)`
 * (story 1.4) and every state-machine edge (story 1.3) reference this enum.
 */
export const FLOW = {
  General: 'General',
  Contract: 'Contract',
  Payment: 'Payment',
} as const

export type Flow = (typeof FLOW)[keyof typeof FLOW]

export const ALL_FLOWS: readonly Flow[] = Object.values(FLOW)
