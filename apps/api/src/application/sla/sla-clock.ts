import { Injectable } from '@nestjs/common'
import { SlaPauseRepo } from '../../infra/prisma/sla/sla-pause.repo'
import { effectiveEnteredAt } from '../../domain/sla/pause'

export interface ClockState {
  /** Feed THIS to dwellDays/overdueDays — paused time is already excluded. */
  enteredAt: Date
  paused: boolean
  pauseReason: string | null
}

interface Row {
  id: string
  statusEnteredAt: Date
}

/**
 * F8 — the one place that turns raw `status_entered_at` into the instant SLA
 * should measure from. Every read path goes through here, so a pause is honoured
 * identically on the board, the Pool, the detail page and the reminder scheduler
 * — a badge that disagreed with the card would be worse than no pause at all.
 */
@Injectable()
export class SlaClock {
  constructor(private readonly pauses: SlaPauseRepo) {}

  async forRows(rows: readonly Row[], now: Date): Promise<Map<string, ClockState>> {
    const out = new Map<string, ClockState>()
    if (rows.length === 0) return out
    const windows = await this.pauses.windowsFor(rows)
    for (const r of rows) {
      const w = windows.get(r.id) ?? []
      out.set(r.id, {
        enteredAt: effectiveEnteredAt(r.statusEnteredAt, w, now),
        paused: w.some((x) => x.to === null),
        pauseReason: null,
      })
    }
    return out
  }

  /** Single-ticket variant, with the open pause's reason for the detail page. */
  async forOne(row: Row, now: Date): Promise<ClockState> {
    const state = (await this.forRows([row], now)).get(row.id)
    const base: ClockState = state ?? { enteredAt: row.statusEnteredAt, paused: false, pauseReason: null }
    if (!base.paused) return base
    const open = await this.pauses.openFor(row.id)
    return { ...base, pauseReason: open?.reason ?? null }
  }
}

/** Resolve one row's effective start, falling back to the raw value. */
export function startOf(states: Map<string, ClockState>, row: Row): Date {
  return states.get(row.id)?.enteredAt ?? row.statusEnteredAt
}
