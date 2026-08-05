import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyWebhookHmac } from './webhook-hmac'

const SECRET = 'top-secret'
const body = Buffer.from('{"type":"user.locked","user_id":"s"}')
const goodSig = createHmac('sha256', SECRET).update(body).digest('hex')

describe('verifyWebhookHmac', () => {
  it('accepts a correct signature', () => {
    expect(verifyWebhookHmac(body, goodSig, SECRET)).toBe(true)
  })

  it('rejects a wrong signature', () => {
    expect(verifyWebhookHmac(body, 'deadbeef', SECRET)).toBe(false)
    expect(verifyWebhookHmac(body, goodSig, 'other-secret')).toBe(false)
  })

  it('rejects a tampered body', () => {
    expect(verifyWebhookHmac(Buffer.from('{"type":"user.deleted"}'), goodSig, SECRET)).toBe(false)
  })

  it('tolerates a sha256= prefix and uppercase hex (wire-format variants)', () => {
    expect(verifyWebhookHmac(body, `sha256=${goodSig}`, SECRET)).toBe(true)
    expect(verifyWebhookHmac(body, `SHA256=${goodSig.toUpperCase()}`, SECRET)).toBe(true)
    expect(verifyWebhookHmac(body, ` ${goodSig} `, SECRET)).toBe(true)
  })

  it('fails closed on missing secret or signature (no throw on length mismatch)', () => {
    expect(verifyWebhookHmac(body, goodSig, null)).toBe(false)
    expect(verifyWebhookHmac(body, goodSig, undefined)).toBe(false)
    expect(verifyWebhookHmac(body, undefined, SECRET)).toBe(false)
    expect(verifyWebhookHmac(body, 'short', SECRET)).toBe(false)
  })
})
