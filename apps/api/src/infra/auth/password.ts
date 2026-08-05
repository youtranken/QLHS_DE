import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

// Local (non-SSO) SA credentials. scrypt keeps us dependency-free on-prem; the
// stored form is `scrypt$<saltHex>$<hashHex>` and compares in constant time.
const scryptAsync = promisify(scrypt)
const KEY_LEN = 64
const SALT_LEN = 16

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN)
  const derived = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const derived = (await scryptAsync(plain, Buffer.from(saltHex, 'hex'), expected.length)) as Buffer
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}
