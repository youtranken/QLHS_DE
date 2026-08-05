import { describe, it, expect } from 'vitest'
import { openPauses, pausesByStation, STALE_PAUSE_DAYS, type PauseRow } from './pause-report'

const MON = new Date('2026-07-20T02:00:00.000Z') // a Monday
const NOW = new Date('2026-07-27T02:00:00.000Z') // the Monday after — 5 business days later

function row(over: Partial<PauseRow> = {}): PauseRow {
  return {
    ticketId: 't1',
    code: 'PMH-A-2026-0001',
    status: 'SubmittedToDcc2',
    flow: 'General',
    reason: 'Chờ nhà thầu bổ sung bản gốc',
    pausedBySub: 'dcc2-hoa',
    pausedAt: MON,
    resumedAt: null,
    ...over,
  }
}

describe('openPauses (which clocks are stopped right now, longest first)', () => {
  it('ignores pauses that already ended — those clocks are running again', () => {
    const rows = [row({ resumedAt: NOW }), row({ ticketId: 't2', code: 'B' })]
    expect(openPauses(rows, NOW).map((p) => p.ticketId)).toEqual(['t2'])
  })

  it('counts business days stopped, weekend excluded', () => {
    expect(openPauses([row()], NOW)[0]?.pausedDays).toBe(5)
  })

  it('puts the longest-running pause first — that is the one to ask about', () => {
    const rows = [
      row({ ticketId: 'fresh', pausedAt: new Date('2026-07-24T02:00:00.000Z') }),
      row({ ticketId: 'old', pausedAt: MON }),
    ]
    expect(openPauses(rows, NOW).map((p) => p.ticketId)).toEqual(['old', 'fresh'])
  })

  it(`flags a pause stale once it reaches ${STALE_PAUSE_DAYS} business days — a wait that long stopped being "chờ bổ sung"`, () => {
    const [stale] = openPauses([row()], NOW)
    expect(stale?.stale).toBe(true)
  })

  it('does not flag a pause that is still young', () => {
    const [fresh] = openPauses([row({ pausedAt: new Date('2026-07-24T02:00:00.000Z') })], NOW)
    expect(fresh?.pausedDays).toBe(1)
    expect(fresh?.stale).toBe(false)
  })

  it('reports nothing when no clock is stopped', () => {
    expect(openPauses([], NOW)).toEqual([])
  })
})

describe('pausesByStation (where is pause being leaned on?)', () => {
  const rows: PauseRow[] = [
    row({ ticketId: 't1', status: 'SubmittedToDcc2' }),
    row({ ticketId: 't1', status: 'SubmittedToDcc2', pausedAt: MON, resumedAt: NOW }),
    row({ ticketId: 't2', status: 'SubmittedToDcc2', resumedAt: NOW }),
    row({ ticketId: 't3', status: 'SubmittedToVpAndy', resumedAt: NOW }),
  ]

  it('counts every pause event at a station, not just distinct tickets', () => {
    const dcc2 = pausesByStation(rows, NOW).find((s) => s.status === 'SubmittedToDcc2')
    expect(dcc2?.pauses).toBe(3)
    expect(dcc2?.tickets).toBe(2) // t1 was paused twice
  })

  it('separates how many are still stopped right now', () => {
    const dcc2 = pausesByStation(rows, NOW).find((s) => s.status === 'SubmittedToDcc2')
    expect(dcc2?.openNow).toBe(1)
  })

  it('reports the longest single pause seen at the station', () => {
    const dcc2 = pausesByStation(rows, NOW).find((s) => s.status === 'SubmittedToDcc2')
    expect(dcc2?.longestDays).toBe(5)
  })

  it('ranks the station leaning on pause hardest first', () => {
    expect(pausesByStation(rows, NOW).map((s) => s.status)).toEqual([
      'SubmittedToDcc2',
      'SubmittedToVpAndy',
    ])
  })

  it('is empty when nobody has paused anything', () => {
    expect(pausesByStation([], NOW)).toEqual([])
  })
})
