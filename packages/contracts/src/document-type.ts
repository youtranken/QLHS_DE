import { FLOW, type Flow } from './flow.js'

/**
 * Applicant-selected document type (PRD §3.1). Determines the flow via mapFlow
 * (story 1.4). Contract/VO/Annex/Budget all route to the Contract flow.
 */
export const DOCUMENT_TYPE = {
  General: 'General',
  Contract: 'Contract',
  VO: 'VO',
  Annex: 'Annex',
  Budget: 'Budget',
  Payment: 'Payment',
} as const

export type DocumentType = (typeof DOCUMENT_TYPE)[keyof typeof DOCUMENT_TYPE]

export const ALL_DOCUMENT_TYPES: readonly DocumentType[] = Object.values(DOCUMENT_TYPE)

/**
 * Document types grouped by processing flow, in flow order. Drives the grouped
 * <optgroup> Applicant picker (one heading per flow). MUST stay in sync with
 * mapFlow (apps/api domain) — the spec asserts full coverage to catch drift.
 */
export const DOCUMENT_TYPE_GROUPS: ReadonlyArray<{
  flow: Flow
  types: readonly DocumentType[]
}> = [
  { flow: FLOW.General, types: [DOCUMENT_TYPE.General] },
  {
    flow: FLOW.Contract,
    types: [DOCUMENT_TYPE.Contract, DOCUMENT_TYPE.VO, DOCUMENT_TYPE.Annex, DOCUMENT_TYPE.Budget],
  },
  { flow: FLOW.Payment, types: [DOCUMENT_TYPE.Payment] },
]
