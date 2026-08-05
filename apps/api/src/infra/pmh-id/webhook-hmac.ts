import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verify the `x-pmh-signature` header = HMAC-SHA256(rawBody, secret) as hex.
 * PMH ID (QLTS parity) sends bare lowercase hex; we also tolerate an optional
 * `sha256=` prefix and hex case so a wire-format variant doesn't silently kill the
 * channel. Timing-safe + length-guarded. Missing secret/signature ⇒ false (fail
 * closed), never throws.
 */
export function verifyWebhookHmac(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string | null | undefined,
): boolean {
  if (!secret || !signature) return false
  const normalized = signature.trim().replace(/^sha256=/i, '').toLowerCase()
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const sig = Buffer.from(normalized)
  const exp = Buffer.from(expected)
  return sig.length === exp.length && timingSafeEqual(sig, exp)
}
