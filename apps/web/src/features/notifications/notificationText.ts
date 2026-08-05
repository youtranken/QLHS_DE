import { kindMessage, t } from '../../i18n'

// Kind map moved to i18n/vi/notifications.ts; seam kept so importers/specs hold.
export function messageForKind(kind: string): string {
  return kindMessage(kind)
}

/** Short "x phút trước" style relative time. Deliberately different wording from
 *  tickets/relTime ("5 phút trước" vs "5 phút") — both read the catalog. */
export function relativeTime(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return t('common.time.justNow')
  if (min < 60) return t('common.time.minutesAgo', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24) return t('common.time.hoursAgo', { n: h })
  return t('common.time.daysAgo', { n: Math.floor(h / 24) })
}
