import { DOCUMENT_TYPE, FLOW, type DocumentType, type Flow } from '@qlhs/contracts'

const FLOW_BY_TYPE: Record<DocumentType, Flow> = {
  [DOCUMENT_TYPE.General]: FLOW.General,
  [DOCUMENT_TYPE.Contract]: FLOW.Contract,
  [DOCUMENT_TYPE.VO]: FLOW.Contract,
  [DOCUMENT_TYPE.Annex]: FLOW.Contract,
  [DOCUMENT_TYPE.Budget]: FLOW.Contract,
  [DOCUMENT_TYPE.Payment]: FLOW.Payment,
}

/** Map a document type to its processing flow (B1 — full-name enum, never A/B/C). */
export function mapFlow(documentType: DocumentType): Flow {
  return FLOW_BY_TYPE[documentType]
}
