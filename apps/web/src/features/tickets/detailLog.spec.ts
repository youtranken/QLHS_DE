import { describe, expect, it } from 'vitest'
import { mergeLog } from './detailLog'
import type { PauseEntry, TimelineEntry } from './api'

const event = (occurredAt: string): TimelineEntry => ({
  action: 'handoverDcc2',
  fromStatus: 'In Process by DCC1',
  toStatus: 'Submitted to DCC2',
  actorSub: 'dcc1-lan',
  occurredAt,
  reason: null,
})

const pause = (pausedAt: string, resumedAt: string | null): PauseEntry => ({
  pausedAt,
  resumedAt,
  reason: 'Chờ nhà thầu bổ sung bản gốc',
  pausedBySub: 'dcc2-hoa',
  status: 'Submitted to DCC2',
})

describe('mergeLog — the ticket must explain its own quiet stretches', () => {
  it('weaves a pause and its resume into the event log, newest first', () => {
    const rows = mergeLog(
      [event('2026-07-20T02:00:00.000Z'), event('2026-07-24T02:00:00.000Z')],
      [pause('2026-07-21T02:00:00.000Z', '2026-07-23T02:00:00.000Z')],
    )
    expect(rows.map((r) => r.kind)).toEqual(['event', 'resume', 'pause', 'event'])
  })

  it('lists a pause that is still open, with no resume row', () => {
    const rows = mergeLog([], [pause('2026-07-21T02:00:00.000Z', null)])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('pause')
  })

  it('carries the reason through — the whole point of recording it', () => {
    const [row] = mergeLog([], [pause('2026-07-21T02:00:00.000Z', null)])
    expect(row?.kind === 'pause' && row.pause.reason).toBe('Chờ nhà thầu bổ sung bản gốc')
  })

  it('is just the events when nothing was ever paused', () => {
    expect(mergeLog([event('2026-07-20T02:00:00.000Z')], [])).toHaveLength(1)
  })
})
