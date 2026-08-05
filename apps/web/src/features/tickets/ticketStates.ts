// Shared state buckets for the applicant list (table + StatusCell + filters).
export const RETURN_STATES = new Set(['Returned', 'Return-fixing'])
export const CLOSED = new Set(['Completed', 'Cancelled', 'Sent to Accounting'])

export type Filter = 'all' | 'running' | 'returned' | 'closed'

export const FLOW_CHIP: Record<string, string> = {
  Contract: 'fl-contract',
  Payment: 'fl-payment',
  General: 'fl-general',
}
