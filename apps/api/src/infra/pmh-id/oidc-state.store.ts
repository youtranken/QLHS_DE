import { Injectable } from '@nestjs/common'

interface OidcTx {
  nonce: string
  verifier: string
  createdAt: number
}

/** Short-lived state/nonce/PKCE-verifier store for in-flight OIDC logins. */
@Injectable()
export class OidcStateStore {
  private readonly txs = new Map<string, OidcTx>()
  private readonly ttlMs = 10 * 60 * 1000

  put(state: string, tx: { nonce: string; verifier: string }): void {
    this.gc()
    this.txs.set(state, { ...tx, createdAt: Date.now() })
  }

  take(state: string): { nonce: string; verifier: string } | undefined {
    const tx = this.txs.get(state)
    if (!tx) return undefined
    this.txs.delete(state)
    if (Date.now() - tx.createdAt > this.ttlMs) return undefined
    return { nonce: tx.nonce, verifier: tx.verifier }
  }

  private gc(): void {
    const now = Date.now()
    for (const [state, tx] of this.txs) {
      if (now - tx.createdAt > this.ttlMs) this.txs.delete(state)
    }
  }
}
