import { FLOW, type Flow } from '@qlhs/contracts'

/**
 * Document code prefix by flow (PRD §3.3): General → `G`; Contract + Payment
 * share `CT` (reports count by document type, not prefix).
 */
export function prefixForFlow(flow: Flow): string {
  return flow === FLOW.General ? 'G' : 'CT'
}

/** `G-0001-2026` — sequence (4-digit zero-padded, never truncated past 4) then the
 *  year. Per-(prefix,year) counter, so the year still identifies the run. */
export function formatCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${String(seq).padStart(4, '0')}-${year}`
}

/**
 * Atomic per-(prefix,year) counter (AD-5). Runs inside the AD-2 transition so a
 * rollback un-does the increment — a Postgres sequence would skip numbers and
 * break the "continuous run" invariant.
 */
export interface NumberingPort {
  next(prefix: string, year: number): Promise<number>
}
