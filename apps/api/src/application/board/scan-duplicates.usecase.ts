import { Injectable } from '@nestjs/common'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { findDuplicates, type DupHint, type DupSubject } from '../../domain/ticket/duplicate'

/** Tier-2 lookback; the domain applies the same bound per candidate. */
const WINDOW_DAYS = 30

/**
 * F12 — resolves duplicate hints for a batch of tickets in ONE query, so a Pool
 * of N cards costs a single fetch instead of N. Ranking/matching stays in the
 * domain (`findDuplicates`); this only supplies the candidate set.
 */
@Injectable()
export class ScanDuplicatesUseCase {
  constructor(
    private readonly tickets: TicketQueryRepo,
    private readonly clock: SystemClock,
  ) {}

  async forSubjects(subjects: readonly DupSubject[]): Promise<Map<string, DupHint[]>> {
    const out = new Map<string, DupHint[]>()
    if (subjects.length === 0) return out
    const now = this.clock.now()
    const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000)
    const candidates = await this.tickets.listDuplicateCandidates(since)
    for (const s of subjects) {
      const hits = findDuplicates(s, candidates, now)
      if (hits.length > 0) out.set(s.id, hits)
    }
    return out
  }
}
