export interface PageWindow {
  page: number
  skip: number
  take: number
}

/** Clamp a 1-based page request to a valid window. Page < 1 becomes 1; pageSize is
 *  bounded so a hostile `?page=` can't ask for an unbounded scan of the audit. */
export function pageWindow(page: number, pageSize: number): PageWindow {
  const size = Math.min(Math.max(1, Math.floor(pageSize) || 1), 200)
  const p = Math.max(1, Math.floor(page) || 1)
  return { page: p, skip: (p - 1) * size, take: size }
}

/** Total pages for a result count (>= 1, so an empty result still reads "1/1"). */
export function totalPages(total: number, pageSize: number): number {
  const size = Math.max(1, pageSize)
  return Math.max(1, Math.ceil(total / size))
}
