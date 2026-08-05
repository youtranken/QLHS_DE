import type { DocumentType } from '@qlhs/contracts'

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
