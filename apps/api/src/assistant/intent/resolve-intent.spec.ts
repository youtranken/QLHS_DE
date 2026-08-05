import { describe, expect, it } from 'vitest'
import { ROLE } from '@qlhs/contracts'
import { resolveIntent } from './resolve-intent'
import { TOOL } from './types'

const AS = ROLE.Applicant
const R = [ROLE.Applicant]

describe('resolveIntent — mã hồ sơ', () => {
  it('có mã, không từ khoá → chi tiết', () => {
    const it = resolveIntent('cho tôi xem G-2026-0001', AS, R)
    expect(it).toMatchObject({ kind: 'tool', tool: TOOL.TicketDetail, args: { code: 'G-2026-0001' } })
  })
  it('có mã + "bước tiếp theo" → whats_next', () => {
    const it = resolveIntent('G-2026-0001 bước tiếp theo là gì', AS, R)
    expect(it).toMatchObject({ kind: 'tool', tool: TOOL.WhatsNext, args: { code: 'G-2026-0001' } })
  })
})

describe('resolveIntent — thông báo vs danh sách', () => {
  it('"thông báo chưa đọc" → notifications, unreadOnly', () => {
    const it = resolveIntent('thông báo chưa đọc', AS, R)
    expect(it).toMatchObject({ kind: 'tool', tool: TOOL.Notifications, args: { unreadOnly: true } })
  })
  it('"hồ sơ của tôi" → my_tickets', () => {
    const it = resolveIntent('hồ sơ của tôi', AS, R)
    expect(it).toMatchObject({ kind: 'tool', tool: TOOL.MyTickets })
  })
  it('"hồ sơ của tôi đang trễ" → my_tickets kèm filter overdue', () => {
    const it = resolveIntent('hồ sơ của tôi đang trễ', AS, R)
    expect(it).toMatchObject({ kind: 'tool', tool: TOOL.MyTickets, filters: { overdue: true } })
  })
})

describe('resolveIntent — mơ hồ & không hiểu', () => {
  it('trộn "thông báo" và "hồ sơ" trong một mệnh đề → clarify', () => {
    const it = resolveIntent('thông báo hồ sơ của tôi', AS, R)
    expect(it.kind).toBe('clarify')
  })
  it('câu lạ, không mã/không từ khoá → unknown + gợi ý', () => {
    const it = resolveIntent('thời tiết hôm nay thế nào', AS, R)
    expect(it.kind).toBe('unknown')
    if (it.kind === 'unknown') expect(it.suggestions.length).toBeGreaterThan(0)
  })
})
