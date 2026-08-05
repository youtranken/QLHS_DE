import { describe, expect, it } from 'vitest'
import { digestTemplate } from './digest-template'
import type { Digest } from './digest'

const empty: Digest = { overdue: [], dueSoon: [], awaiting: [], total: 0 }
const line = (code: string, over = 0, left = 0) => ({
  code,
  flow: 'Contract',
  status: 'Submitted to VP Andy',
  overdueDays: over,
  daysLeft: left,
})

describe('digestTemplate — the subject must be readable from a phone lock screen', () => {
  it('leads with the count that matters most', () => {
    const { subject } = digestTemplate({
      digest: { ...empty, overdue: [line('A', 2)], dueSoon: [line('B')], total: 2 },
      name: 'Lan',
      date: new Date(Date.UTC(2026, 6, 27)),
    })
    expect(subject).toContain('1 hồ sơ TRỄ')
    expect(subject).toContain('1 sắp trễ')
  })

  it('omits sections that are empty rather than printing "0"', () => {
    const { subject } = digestTemplate({
      digest: { ...empty, awaiting: [line('C')], total: 1 },
      name: 'Lan',
      date: new Date(Date.UTC(2026, 6, 27)),
    })
    expect(subject).not.toContain('0 ')
    expect(subject).toContain('1 chờ xác nhận')
  })
})

describe('digestTemplate — the body must say what to do, per ticket', () => {
  const built = digestTemplate({
    digest: {
      overdue: [line('PMH-C-0791', 2)],
      dueSoon: [line('PMH-B-0812', 0, 0)],
      awaiting: [line('PMH-B-0808')],
      total: 3,
    },
    name: 'Lan',
    date: new Date(Date.UTC(2026, 6, 27)),
  })

  it('greets the person by name, not by their PMH sub', () => {
    expect(built.body).toContain('Lan')
  })

  it('lists every ticket code it counted', () => {
    for (const code of ['PMH-C-0791', 'PMH-B-0812', 'PMH-B-0808']) {
      expect(built.body).toContain(code)
    }
  })

  it('says how late the late one is', () => {
    expect(built.body).toMatch(/trễ 2 ngày/i)
  })

  it('says "hôm nay" for a ticket whose SLA runs out today', () => {
    expect(built.body).toMatch(/hôm nay/i)
  })

  it('tells the reader how to stop receiving it — an un-unsubscribable robot is spam', () => {
    expect(built.body).toMatch(/tắt/i)
  })
})
