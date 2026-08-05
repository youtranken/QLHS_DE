import { FLOW, type Flow } from '@qlhs/contracts'

/**
 * Document code prefix by flow (PRD §3.3): General → `G`; Contract + Payment
 * share `CT` (reports count by document type, not prefix).
 */
export function prefixForFlow(flow: Flow): string {
  return flow === FLOW.General ? 'G' : 'CT'
}

/** `G-2026-0001` — 4-digit zero-padded, but never truncated past 4 digits. */
export function formatCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}

/**
 * Atomic per-(prefix,year) counter (AD-5). Runs inside the AD-2 transition so a
 * rollback un-does the increment — a Postgres sequence would skip numbers and
 * break the "continuous run" invariant.
 */
export interface NumberingPort {
  next(prefix: string, year: number): Promise<number>
}
