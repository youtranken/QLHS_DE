import { localeTag } from './t'

/** Locale-aware date/number rendering — follows setLocale() automatically. */
export const fmtDate = (iso: string): string => new Date(iso).toLocaleDateString(localeTag())
export const fmtDateTime = (iso: string): string => new Date(iso).toLocaleString(localeTag())
