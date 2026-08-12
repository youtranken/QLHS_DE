import { FLOW, type DocumentType, type Flow } from '@qlhs/contracts'

/**
 * The 9 mandatory Applicant fields (PRD §3.1). Amount is an integer in the
 * currency's smallest unit + a currency code (Conventions: no floats).
 */
export interface ApplicantFields {
  documentType: DocumentType
  description: string
  paymentTerm: string
  contractNo: string
  projectTeam: string
  currency: string
  amount: bigint
  budgetCode: string
  contractor: string
}

export interface FieldChange {
  field: keyof ApplicantFields
  old: string
  new: string
}

const FIELD_KEYS: readonly (keyof ApplicantFields)[] = [
  'documentType',
  'description',
  'paymentTerm',
  'contractNo',
  'projectTeam',
  'currency',
  'amount',
  'budgetCode',
  'contractor',
]

/**
 * The changed fields between two versions (B6). Values are stringified so the
 * audit meta is JSON-safe (amount is a bigint). Order follows FIELD_KEYS so the
 * audit trail is deterministic; unchanged fields are omitted.
 */
export function diffFields(prev: ApplicantFields, next: ApplicantFields): FieldChange[] {
  const changes: FieldChange[] = []
  for (const field of FIELD_KEYS) {
    if (prev[field] !== next[field]) {
      changes.push({ field, old: String(prev[field]), new: String(next[field]) })
    }
  }
  return changes
}

/**
 * Contract No is DCC2-owned on the Contract flow: the applicant slot stays the
 * 'N/A' placeholder until DCC2 assigns the real number at send-to-Accounting. This
 * is the SERVER-side invariant (AD-16) — the create form mirrors it, but the FR-3
 * clone endpoint and any direct API client bypass the form, so every write path
 * (create / clone / field-edit) must pass through here. Payment/General keep the
 * applicant-entered reference, stored UPPERCASE (case-folded like Contract No so the
 * per-flow unique index can't be bypassed by case).
 */
export function normalizeContractNo(fields: ApplicantFields, flow: Flow): ApplicantFields {
  if (flow === FLOW.Contract) return { ...fields, contractNo: 'N/A' }
  return { ...fields, contractNo: fields.contractNo.toUpperCase() }
}

/**
 * Clone for "create from existing" (FR-3): copies ONLY the 9 fields — never the
 * code, DCC fields, timeline, or round_no. The new ticket starts clean.
 */
export function cloneFields(src: ApplicantFields): ApplicantFields {
  return {
    documentType: src.documentType,
    description: src.description,
    paymentTerm: src.paymentTerm,
    contractNo: src.contractNo,
    projectTeam: src.projectTeam,
    currency: src.currency,
    amount: src.amount,
    budgetCode: src.budgetCode,
    contractor: src.contractor,
  }
}
