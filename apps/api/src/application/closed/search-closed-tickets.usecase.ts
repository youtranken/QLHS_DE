import { Injectable } from '@nestjs/common'
import type { Role } from '@qlhs/contracts'
import { roleFlows } from '../../domain/dispatch/role-flows'
import { TicketQueryRepo, type ClosedFilters, type ClosedCursor } from '../../infra/prisma/ticket/ticket-query.repo'
import { toTicketView, type TicketView } from '../core/ticket-view'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface ClosedPage {
  items: TicketView[]
  /** Opaque token to fetch the next page; null when this is the last page. */
  nextCursor: string | null
}

/**
 * FR-17 — search closed tickets to find one to reopen. The caller's role fixes
 * the flow scope (DCC1 all three, DCC2 Contract, DCC3 Payment); the repo enforces
 * it. Keyset-paginated (newest-closed first) so the closed archive can grow for
 * years without any single request loading it all.
 */
@Injectable()
export class SearchClosedTicketsUseCase {
  constructor(private readonly repo: TicketQueryRepo) {}

  async execute(
    role: Role | null,
    filters: ClosedFilters,
    page?: { limit?: number; cursor?: string },
  ): Promise<ClosedPage> {
    const limit = Math.min(Math.max(page?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const rows = await this.repo.searchClosed(roleFlows(role), filters, {
      limit,
      cursor: decodeCursor(page?.cursor),
    })
    // The repo asked for limit+1; a full extra row means there's another page.
    const hasMore = rows.length > limit
    const kept = hasMore ? rows.slice(0, limit) : rows
    const last = kept[kept.length - 1]
    return {
      items: kept.map(toTicketView),
      nextCursor: hasMore && last ? encodeCursor(last.statusEnteredAt, last.id) : null,
    }
  }
}

// Cursor = base64("<iso closed-at>|<id>"). Opaque to the client; unparseable or
// malformed tokens degrade to "first page" rather than erroring.
function encodeCursor(statusEnteredAt: Date, id: string): string {
  return Buffer.from(`${statusEnteredAt.toISOString()}|${id}`, 'utf8').toString('base64url')
}

function decodeCursor(token?: string): ClosedCursor | undefined {
  if (!token) return undefined
  try {
    const [iso, id] = Buffer.from(token, 'base64url').toString('utf8').split('|')
    const at = iso ? new Date(iso) : new Date(NaN)
    if (!id || Number.isNaN(at.getTime())) return undefined
    return { statusEnteredAt: at, id }
  } catch {
    return undefined
  }
}
