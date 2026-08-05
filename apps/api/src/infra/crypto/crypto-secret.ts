import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Encrypt an application secret (the SMTP password) so it is never stored as
 * plaintext in the DB. AES-256-GCM, key = SHA-256(CONFIG_ENC_KEY) → accepts any
 * env key length. Ciphertext = iv.tag.data (base64); the auth tag makes tampering
 * self-detecting. The key lives ONLY in the env (never in the DB), so a plain DB
 * dump cannot decrypt it — a controlled concession for the SMTP config UI.
 */
function key(): Buffer {
  const raw = process.env.CONFIG_ENC_KEY
  if (!raw) {
    throw new Error('CONFIG_ENC_KEY chưa cấu hình — không mã hoá/giải mã được secret SMTP.')
  }
  return createHash('sha256').update(raw).digest()
}

export function hasEncKey(): boolean {
  return !!process.env.CONFIG_ENC_KEY
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`
}

export function decryptSecret(enc: string): string {
  const [ivB, tagB, ctB] = enc.split('.')
  if (!ivB || !tagB || !ctB) throw new Error('Ciphertext SMTP sai định dạng.')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8')
}
