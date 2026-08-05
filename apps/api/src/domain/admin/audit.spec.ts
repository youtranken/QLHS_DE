import { describe, it, expect } from 'vitest'
import { pageWindow, totalPages } from './audit'

describe('pageWindow (safe pagination)', () => {
  it('computes skip/take for a valid page', () => {
    expect(pageWindow(3, 25)).toEqual({ page: 3, skip: 50, take: 25 })
  })
  it('clamps page below 1 up to 1', () => {
    expect(pageWindow(0, 25)).toEqual({ page: 1, skip: 0, take: 25 })
    expect(pageWindow(-4, 25)).toEqual({ page: 1, skip: 0, take: 25 })
  })
  it('bounds pageSize so a hostile query cannot scan everything', () => {
    expect(pageWindow(1, 100000).take).toBe(200)
    expect(pageWindow(1, 0).take).toBe(1)
  })
})

describe('totalPages', () => {
  it('rounds up', () => {
    expect(totalPages(51, 25)).toBe(3)
    expect(totalPages(50, 25)).toBe(2)
  })
  it('is at least 1 for an empty result', () => {
    expect(totalPages(0, 25)).toBe(1)
  })
})
