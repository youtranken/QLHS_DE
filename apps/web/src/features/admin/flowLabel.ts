import { t } from '../../i18n'

/** Canonical flow → VI display name (catalog `adminAnalytics.flows`, Record mở —
 *  t() trả lại nguyên key khi thiếu nên fallback về chính flow). */
export function flowVi(flow: string): string {
  const key = `adminAnalytics.flows.${flow}` as const
  const s = t(key)
  return s === key ? flow : s
}
