import { ApiClientError } from './api-client'

/**
 * The server's own words when it gave them, our fallback otherwise.
 *
 * DomainErrorFilter answers with `{ code, message }` — "Chỉ người đang giữ hồ sơ
 * mới dừng/chạy lại đồng hồ SLA" is far more use than a generic failure line.
 * The presence of `code` is what marks a deliberate envelope; a bare 500 has
 * none, and its message would only be "HTTP 500".
 */
export function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiClientError && e.code ? e.message : fallback
}
