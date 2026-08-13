/** Danh sách email KHÔNG bao giờ nhận mail (AD-12 choke point trong send()).
 *  Nguồn: env QLHS_MAIL_SUPPRESS (phẩy-phân-cách). Khi env trống → mặc định
 *  chặn 3 tài khoản admin nội bộ để chúng không bị spam thông báo/digest.
 *  So khớp theo địa chỉ đã trim + hạ chữ thường; đây là danh sách nhỏ nên Set là đủ. */

const DEFAULT_SUPPRESS =
  'admin1@pmh.com.vn,admin2@pmh.com.vn,admin3@pmh.com.vn'

export function parseSuppressList(raw: string | undefined): Set<string> {
  const src = raw ?? DEFAULT_SUPPRESS
  return new Set(
    src
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** Pull the bare address(es) out of a header value that may be wrapped as
 *  "Name <email>" and may list several comma-separated recipients. */
export function extractAddresses(to: string): string[] {
  return to
    .split(',')
    .map((part) => {
      const angled = part.match(/<([^>]+)>/)
      return (angled ? angled[1]! : part).trim().toLowerCase()
    })
    .filter(Boolean)
}

/** Suppress a send only when it HAS recipients and every one is on the list — a
 *  mixed send is never silently dropped just because one co-recipient is blocked. */
export function isSuppressed(to: string, list: Set<string>): boolean {
  const addrs = extractAddresses(to)
  return addrs.length > 0 && addrs.every((a) => list.has(a))
}
