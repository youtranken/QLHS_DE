import { describe, it, expect, beforeEach } from 'vitest'
import { loadViews, saveViews, upsertView, removeView, isViewActive } from './boardViews'
import { EMPTY_FILTER, type BoardFilter } from './boardFilter'

const f = (over: Partial<BoardFilter> = {}): BoardFilter => ({ ...EMPTY_FILTER, ...over })

describe('boardViews', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips through localStorage', () => {
    saveViews([{ name: 'Quá hạn B', filter: f({ flow: 'Contract', overOnly: true }) }])
    const got = loadViews()
    expect(got).toHaveLength(1)
    expect(got[0]).toEqual({ name: 'Quá hạn B', filter: f({ flow: 'Contract', overOnly: true }) })
  })

  it('returns [] on missing or corrupt storage', () => {
    expect(loadViews()).toEqual([])
    localStorage.setItem('qlhs-board-views', 'not json')
    expect(loadViews()).toEqual([])
  })

  it('upsert replaces a same-named view and ignores an empty name', () => {
    let v = upsertView([], 'V1', f({ priority: 'rush' }))
    v = upsertView(v, 'V1', f({ priority: 'urgent' }))
    expect(v).toHaveLength(1)
    expect(v[0]!.filter.priority).toBe('urgent')
    expect(upsertView(v, '   ', f())).toBe(v)
  })

  it('remove drops by name', () => {
    const v = [{ name: 'A', filter: f() }, { name: 'B', filter: f() }]
    expect(removeView(v, 'A').map((x) => x.name)).toEqual(['B'])
  })

  it('isViewActive compares facets (ignoring q whitespace)', () => {
    const view = { name: 'x', filter: f({ flow: 'Payment', q: 'abc' }) }
    expect(isViewActive(view, f({ flow: 'Payment', q: ' abc ' }))).toBe(true)
    expect(isViewActive(view, f({ flow: 'General', q: 'abc' }))).toBe(false)
  })
})
