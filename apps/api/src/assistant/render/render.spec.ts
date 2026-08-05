import { describe, expect, it } from 'vitest'
import { renderTool } from './render'
import { TOOL, type Intent } from '../intent/types'

function ti(tool: string, args: Record<string, unknown> = {}): Extract<Intent, { kind: 'tool' }> {
  return { kind: 'tool', tool, args }
}

describe('renderTool — block Pha 2', () => {
  it('dispatch map → stats với tổng + số trễ mỗi luồng', () => {
    const out = [{ flow: 'General', total: 3, stations: [{ status: 's', count: 2, overdueCount: 1, overSla: true }] }]
    const [b] = renderTool(ti(TOOL.DispatchMap), out)
    expect(b.type).toBe('stats')
    if (b.type === 'stats') expect(String(b.items[0].value)).toContain('trễ 1')
  })

  it('overview → stats 6 chỉ số', () => {
    const out = {
      users: { total: 10, appointed: 3, unappointed: 7 },
      runningTotal: 5, overdueTotal: 2, auditToday: 4, lines: [], recent: [], mailPending: 0, pausedTotal: 1,
    }
    const [b] = renderTool(ti(TOOL.Overview), out)
    expect(b.type).toBe('stats')
    if (b.type === 'stats') expect(b.items).toHaveLength(6)
  })

  it('paused → lines với tiêu đề đếm', () => {
    const out = {
      open: [{ ticketId: 't', code: 'G-2026-0001', status: 'Submitted', flow: 'General', reason: 'x', pausedBySub: 'l', pausedByName: 'Lan', pausedAt: '', pausedDays: 3, stale: false }],
      byStation: [], windowDays: 30, staleAfterDays: 7,
    }
    const [b] = renderTool(ti(TOOL.Paused), out)
    expect(b.type).toBe('lines')
    if (b.type === 'lines') {
      expect(b.title).toContain('1')
      expect(b.items[0].secondary).toContain('Lan')
    }
  })

  it('workbox → ticketList', () => {
    const out = [{ code: 'G-2026-0009', flow: 'General', status: 'Submitted to VP Andy', priority: 'normal', overdueDays: 2 }]
    const [b] = renderTool(ti(TOOL.Workbox), out)
    expect(b.type).toBe('ticketList')
  })

  it('analytics → stats + ticketList topOverdue', () => {
    const out = {
      granularity: 'month', flows: [], dwell: [], throughput: [], returns: [],
      topOverdue: [{ id: '1', code: 'G-2026-0009', flow: 'General', status: 'Submitted', overdueDays: 5, holderSub: null }],
    }
    const blocks = renderTool(ti(TOOL.Analytics, { period: 'month' }), out)
    expect(blocks.map((b) => b.type)).toEqual(['stats', 'ticketList'])
  })

  it('audit → lines', () => {
    const out = {
      events: [{ id: '1', occurredAt: '2026-07-31T02:00:00.000Z', actorSub: 'a', actorName: 'Lan', action: 'submit', code: 'G-2026-0001', ticketId: 't', flow: 'General', fromStatus: '', toStatus: 'Submitted', reason: null }],
      total: 1, page: 1, pageSize: 25, totalPages: 1, today: [],
    }
    const [b] = renderTool(ti(TOOL.Audit), out)
    expect(b.type).toBe('lines')
  })
})
