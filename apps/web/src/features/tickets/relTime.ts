import { t } from '../../i18n'

/** Relative "time ago" for the Cập nhật column (terser than notifications'). */
export function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return t('common.time.justNow')
  if (min < 60) return t('common.time.minutes', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24) return t('common.time.hours', { n: h })
  return t('common.time.days', { n: Math.floor(h / 24) })
}
