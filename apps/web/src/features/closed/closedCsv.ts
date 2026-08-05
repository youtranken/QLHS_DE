import type { TicketView } from '../tickets/api'

/** Closed-ticket rows → CSV data cells (no header), matching the on-screen table.
 *  Amount stays a raw number so Excel can sum it; currency is its own column. */
export function closedCsvRows(rows: TicketView[]): string[][] {
  return rows.map((tk) => [
    tk.code ?? tk.id.slice(0, 8),
    tk.flow,
    tk.contractor ?? '',
    tk.amount != null ? String(tk.amount) : '',
    tk.currency ?? '',
    tk.contractNo ?? '',
    tk.createdAt,
    tk.status,
  ])
}
