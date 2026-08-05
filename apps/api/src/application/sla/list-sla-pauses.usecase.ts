import { Injectable } from '@nestjs/common'
import { SlaPauseRepo } from '../../infra/prisma/sla/sla-pause.repo'
import { UserDirectoryRepo } from '../../infra/prisma/users/user-directory.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import {
  openPauses,
  pausesByStation,
  STALE_PAUSE_DAYS,
  type StationPauseStat,
} from '../../domain/admin/pause-report'

/** How far back the station report looks. Long enough to show a habit, short
 *  enough that a station which fixed its habit stops being blamed for it. */
const WINDOW_DAYS = 30

export interface OpenPauseRow {
  ticketId: string
  code: string | null
  status: string
  flow: string
  reason: string
  pausedBySub: string
  pausedByName: string
  pausedAt: string
  pausedDays: number
  stale: boolean
}

export interface SlaPauseReport {
  open: OpenPauseRow[]
  byStation: StationPauseStat[]
  windowDays: number
  staleAfterDays: number
}

/**
 * F8 oversight (Admin-only): who has stopped the clock, for how long, and where
 * pause is being leaned on. Derived at read from `ticket_sla_pause` (AD-6) — the
 * pause table is its own audit record, so no new storage is involved.
 */
@Injectable()
export class ListSlaPausesUseCase {
  constructor(
    private readonly pauses: SlaPauseRepo,
    private readonly directory: UserDirectoryRepo,
    private readonly clock: SystemClock,
  ) {}

  async execute(): Promise<SlaPauseReport> {
    const now = this.clock.now()
    const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000)
    // Two reads on purpose: the station report is bounded to the window it
    // advertises, while an open pause is listed however old it is — an eight-week
    // stopped clock is exactly what an Admin must not have to go looking for.
    const [windowRows, openRows] = await Promise.all([
      this.pauses.listForReport(since),
      this.pauses.listOpen(),
    ])

    const open = openPauses(openRows, now)
    const names = await this.directory.namesForSubs(open.map((p) => p.pausedBySub))

    return {
      open: open.map((p) => ({
        ...p,
        pausedAt: p.pausedAt.toISOString(),
        pausedByName: names[p.pausedBySub] ?? p.pausedBySub,
      })),
      byStation: pausesByStation(windowRows, now),
      windowDays: WINDOW_DAYS,
      staleAfterDays: STALE_PAUSE_DAYS,
    }
  }
}
