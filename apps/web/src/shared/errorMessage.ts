import { ApiClientError } from './api-client'

// Codes whose server `message` is a developer string, never fit to show a user
// (IllegalTransition = "No edge: <status> --<event>--> …"). Common when two people
// act on the same ticket from two surfaces — show the caller's friendly fallback
// ("hồ sơ có thể đã đổi trạng thái") instead of the raw edge string.
const RAW_MESSAGE_HIDDEN = new Set(['IllegalTransition'])

/**
 * The server's own words when it gave them, our fallback otherwise.
 *
 * DomainErrorFilter answers with `{ code, message }` — "Chỉ người đang giữ hồ sơ
 * mới dừng/chạy lại đồng hồ SLA" is far more use than a generic failure line.
 * The presence of `code` is what marks a deliberate envelope; a bare 500 has
 * none, and its message would only be "HTTP 500". A few codes carry a dev-only
 * message and fall back to the friendly line instead.
 */
export function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiClientError && e.code && !RAW_MESSAGE_HIDDEN.has(e.code)
    ? e.message
    : fallback
}
