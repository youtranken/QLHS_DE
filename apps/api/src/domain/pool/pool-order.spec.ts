import { describe, it, expect } from 'vitest'
import { PRIORITY } from '@qlhs/contracts'
import { sortPool } from './pool-order'

const d = (iso: string) => new Date(iso)

describe('sortPool (priority up, then oldest-first)', () => {
  it('floats Urgent/Rush above Normal, oldest first within a tier', () => {
    const items = [
      { id: 'a', priority: PRIORITY.Normal, statusEnteredAt: d('2026-07-01') },
      { id: 'b', priority: PRIORITY.Urgent, statusEnteredAt: d('2026-07-05') },
      { id: 'c', priority: PRIORITY.Normal, statusEnteredAt: d('2026-06-30') },
      { id: 'd', priority: PRIORITY.Rush, statusEnteredAt: d('2026-07-02') },
    ]
    expect(sortPool(items).map((x) => x.id)).toEqual(['b', 'd', 'c', 'a'])
  })

  it('does not mutate the input', () => {
    const items = [
      { id: 'x', priority: PRIORITY.Normal, statusEnteredAt: d('2026-07-02') },
      { id: 'y', priority: PRIORITY.Urgent, statusEnteredAt: d('2026-07-01') },
    ]
    const before = items.map((i) => i.id)
    sortPool(items)
    expect(items.map((i) => i.id)).toEqual(before)
  })
})
