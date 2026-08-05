import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encryptSecret, decryptSecret, hasEncKey } from './crypto-secret'

describe('crypto-secret — AES-256-GCM for the SMTP password', () => {
  const prev = process.env.CONFIG_ENC_KEY
  beforeEach(() => {
    process.env.CONFIG_ENC_KEY = 'test-key-any-length-🔑'
  })
  afterEach(() => {
    if (prev === undefined) delete process.env.CONFIG_ENC_KEY
    else process.env.CONFIG_ENC_KEY = prev
  })

  it('round-trips a secret', () => {
    const enc = encryptSecret('super-smtp-pass')
    expect(enc).not.toContain('super-smtp-pass') // not plaintext
    expect(decryptSecret(enc)).toBe('super-smtp-pass')
  })

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'))
  })

  it('detects tampering via the auth tag', () => {
    const [iv, tag, ct] = encryptSecret('secret').split('.')
    const flipped = ct!.slice(0, -2) + (ct!.endsWith('A') ? 'B' : 'A') + ct!.slice(-1)
    expect(() => decryptSecret(`${iv}.${tag}.${flipped}`)).toThrow()
  })

  it('rejects a malformed ciphertext', () => {
    expect(() => decryptSecret('not-valid')).toThrow(/sai định dạng/)
  })

  it('throws a clear error when the key is missing', () => {
    delete process.env.CONFIG_ENC_KEY
    expect(hasEncKey()).toBe(false)
    expect(() => encryptSecret('x')).toThrow(/CONFIG_ENC_KEY/)
  })
})
