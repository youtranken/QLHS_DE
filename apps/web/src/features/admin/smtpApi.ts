import { apiGet, apiPut, apiPost } from '../../shared/api-client'

/** What the form shows. The password value never travels back — only `hasPassword`. */
export interface SmtpConfigView {
  host: string
  port: number
  secure: boolean
  username: string
  from: string
  hasPassword: boolean
  source: 'db' | 'env' | 'none'
  encKeyReady: boolean
}

export interface SmtpConfigInput {
  host: string
  port: number
  secure: boolean
  username: string
  /** Omit/blank to keep the stored password. */
  password?: string
  from: string
}

export const getSmtpConfig = () => apiGet<SmtpConfigView>('/admin/smtp')
export const saveSmtpConfig = (c: SmtpConfigInput) => apiPut<{ ok: true }>('/admin/smtp', c)
export const testSmtpConfig = (c: SmtpConfigInput & { to: string }) =>
  apiPost<{ ok: true }>('/admin/smtp/test', c)

/** VP display name — single source for the shown "VP Andy" everywhere. */
export interface AppConfigView {
  vpName: string
}
export const getAppConfig = () => apiGet<AppConfigView>('/admin/app-config')
export const saveAppConfig = (vpName: string) => apiPut<{ ok: true }>('/admin/app-config', { vpName })
