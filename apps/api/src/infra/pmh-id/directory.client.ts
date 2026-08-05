import { Injectable } from '@nestjs/common'
import { loadAuthConfig, type OidcConfig } from '../../config/auth.config'

export interface DirectoryUser {
  sub: string
  email: string | null
  fullName: string | null
  groups: string[]
  status: string
}

/**
 * PMH ID Directory API (M2M / client_credentials). Lists the users in the
 * groups granted to this client — so an Admin can assign QLHS roles before a
 * user has ever logged in. Requires the IdP CA (NODE_EXTRA_CA_CERTS).
 */
@Injectable()
export class DirectoryClient {
  private readonly cfg = loadAuthConfig(process.env)
  private tokenCache?: { token: string; exp: number }

  private oidc(): OidcConfig {
    if (!this.cfg.oidc) throw new Error('OIDC not configured')
    return this.cfg.oidc
  }

  private baseUrl(): string {
    return `${new URL(this.oidc().issuer).origin}/api/v1`
  }

  private async token(): Promise<string> {
    if (this.tokenCache && this.tokenCache.exp > Date.now() + 5000) {
      return this.tokenCache.token
    }
    const o = this.oidc()
    const basic = Buffer.from(`${o.clientId}:${o.clientSecret}`).toString('base64')
    const res = await fetch(`${o.issuer}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: 'grant_type=client_credentials',
    })
    if (!res.ok) throw new Error(`M2M token failed: ${res.status}`)
    const data = (await res.json()) as { access_token: string; expires_in?: number }
    this.tokenCache = {
      token: data.access_token,
      exp: Date.now() + (data.expires_in ?? 300) * 1000,
    }
    return data.access_token
  }

  async listUsers(): Promise<DirectoryUser[]> {
    const token = await this.token()
    const res = await fetch(`${this.baseUrl()}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Directory users failed: ${res.status}`)
    const body = (await res.json()) as unknown
    const items = Array.isArray(body)
      ? body
      : ((body as { users?: unknown[]; data?: unknown[]; items?: unknown[] }).users ??
        (body as { data?: unknown[] }).data ??
        (body as { items?: unknown[] }).items ??
        [])
    return (items as Array<Record<string, unknown>>).map((u) => ({
      sub: String(u['id'] ?? ''),
      email: (u['email'] as string | undefined) ?? null,
      fullName: (u['full_name'] as string | undefined) ?? null,
      groups: Array.isArray(u['groups']) ? (u['groups'] as string[]) : [],
      status: String(u['status'] ?? 'active'),
    }))
  }
}
