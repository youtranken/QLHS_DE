import { describe, expect, it } from 'vitest'
import { slaActionsFor, PAUSE_EVENT, RESUME_EVENT } from './slaPauseActions'
import type { BoardCard } from './api'

const card = (over: Partial<BoardCard> = {}): BoardCard => ({
  id: 't1',
  code: 'PMH-A-2026-0001',
  contractor: 'Công ty ABC',
  amount: '1000',
  priority: 'normal',
  flow: 'General',
  status: 'Submitted to VP Andy',
  overdueDays: 0,
  lockedByMe: false,
  lockedBy: null,
  actions: [],
  mine: true,
  paused: false,
  ...over,
})

describe('slaActionsFor — who may stop the clock, and which way it goes', () => {
  it('offers a pause on a running ticket you hold', () => {
    expect(slaActionsFor(card()).map((a) => a.event)).toEqual([PAUSE_EVENT])
  })

  it('offers a resume once it is paused', () => {
    expect(slaActionsFor(card({ paused: true })).map((a) => a.event)).toEqual([RESUME_EVENT])
  })

  it('offers nothing on someone else’s ticket — the server rejects it anyway, so do not tease', () => {
    expect(slaActionsFor(card({ mine: false }))).toEqual([])
    expect(slaActionsFor(card({ mine: false, paused: true }))).toEqual([])
  })

  it('demands a reason to pause but not to resume', () => {
    expect(slaActionsFor(card())[0]?.reasonRequired).toBe(true)
    expect(slaActionsFor(card({ paused: true }))[0]?.reasonRequired).toBe(false)
  })
})
