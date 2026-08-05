import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing (scrypt, local SA credentials)', () => {
  it('verifies a password against its own hash', async () => {
    const hash = await hashPassword('CorrectHorse!42')
    expect(await verifyPassword('CorrectHorse!42', hash)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('CorrectHorse!42')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('salts — two hashes of the same password differ', async () => {
    const a = await hashPassword('same')
    const b = await hashPassword('same')
    expect(a).not.toBe(b)
    expect(await verifyPassword('same', a)).toBe(true)
    expect(await verifyPassword('same', b)).toBe(true)
  })

  it('returns false for a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('x', 'not-a-valid-hash')).toBe(false)
    expect(await verifyPassword('x', '')).toBe(false)
  })
})
