/** Pure date helpers for DatePicker (ported from QLTS). ISO = 'YYYY-MM-DD'. */

export function parseISO(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}
export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
export function decadeStart(d: Date): number {
  return Math.floor(d.getFullYear() / 10) * 10
}
/** 42 cells (6 weeks), Monday-first, with leading/trailing days of adjacent months dimmed. */
export function buildDays(cursor: Date): Array<{ date: Date; dim: boolean }> {
  const y = cursor.getFullYear()
  const m = cursor.getMonth()
  const first = new Date(y, m, 1)
  const offset = (first.getDay() + 6) % 7 // 0 = Monday
  const start = new Date(y, m, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { date, dim: date.getMonth() !== m }
  })
}
export function buildYears(cursor: Date): number[] {
  const s = decadeStart(cursor)
  return Array.from({ length: 12 }, (_, i) => s - 1 + i)
}
