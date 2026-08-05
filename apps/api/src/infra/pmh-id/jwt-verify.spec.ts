import { describe, it, expect } from 'vitest'
import { generateKeyPair, exportJWK, SignJWT, type JSONWebKeySet } from 'jose'
import { verifyAccessToken, claimsToUser } from './jwt-verify'

const ISS = 'https://sso.pmh.example/realms/pmh'
const AUD = 'qlhs-web'

async function makeKit(): Promise<{ privateKey: CryptoKey; jwks: JSONWebKeySet }> {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey)
  jwk.kid = 'k1'
  jwk.alg = 'RS256'
  jwk.use = 'sig'
  return { privateKey: privateKey as CryptoKey, jwks: { keys: [jwk] } }
}

function sign(
  privateKey: CryptoKey,
  opts: { iss?: string; aud?: string; groups?: string[] } = {},
): Promise<string> {
  return new SignJWT({ groups: opts.groups ?? ['grp-dcc1'] })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss ?? ISS)
    .setAudience(opts.aud ?? AUD)
    .setSubject('sub-123')
    .setExpirationTime('5m')
    .sign(privateKey)
}

describe('verifyAccessToken (AD-8 offline JWT verify)', () => {
  it('verifies a well-formed RS256 token and maps claims', async () => {
    const { privateKey, jwks } = await makeKit()
    const token = await sign(privateKey)
    const user = await verifyAccessToken(token, { jwks, issuer: ISS, audience: AUD })
    expect(user.sub).toBe('sub-123')
    expect(user.groups).toEqual(['grp-dcc1'])
  })

  it('rejects a wrong audience (confused-deputy guard)', async () => {
    const { privateKey, jwks } = await makeKit()
    const token = await sign(privateKey, { aud: 'other-client' })
    await expect(
      verifyAccessToken(token, { jwks, issuer: ISS, audience: AUD }),
    ).rejects.toThrow()
  })

  it('rejects a wrong issuer', async () => {
    const { privateKey, jwks } = await makeKit()
    const token = await sign(privateKey, { iss: 'https://evil.example' })
    await expect(
      verifyAccessToken(token, { jwks, issuer: ISS, audience: AUD }),
    ).rejects.toThrow()
  })

  it('rejects a token signed by an unknown key', async () => {
    const attacker = await makeKit()
    const victim = await makeKit()
    const token = await sign(attacker.privateKey)
    await expect(
      verifyAccessToken(token, { jwks: victim.jwks, issuer: ISS, audience: AUD }),
    ).rejects.toThrow()
  })
})

describe('claimsToUser', () => {
  it('throws when sub is missing', () => {
    expect(() => claimsToUser({})).toThrow(/sub/)
  })
  it('defaults groups to empty when absent', () => {
    expect(claimsToUser({ sub: 'x' }).groups).toEqual([])
  })
})
