import { describe, expect, it } from 'vitest'
import { ROLE } from '@qlhs/contracts'
import { resolveIntents } from './resolve-intents'
import { TOOL } from './types'

const AS = ROLE.Applicant
const R = [ROLE.Applicant]

function tools(text: string): string[] {
  return resolveIntents(text, AS, R)
    .filter((i) => i.kind === 'tool')
    .map((i) => (i.kind === 'tool' ? i.tool : ''))
}

describe('resolveIntents — tách nhiều ý có phòng vệ', () => {
  it('"A và B" hai tool khác nhau → tách làm hai', () => {
    expect(tools('hồ sơ của tôi và thông báo chưa đọc')).toEqual([TOOL.MyTickets, TOOL.Notifications])
  })

  it('KHÔNG tách "hồ sơ trễ và gấp" — hai bộ lọc trên MỘT truy vấn', () => {
    const out = resolveIntents('hồ sơ của tôi trễ và gấp', AS, R)
    const t = out.filter((i) => i.kind === 'tool')
    expect(t).toHaveLength(1)
    expect(t[0]).toMatchObject({ tool: TOOL.MyTickets, filters: { overdue: true, urgent: true } })
  })

  it('tách trên "còn" (chuyển chủ đề)', () => {
    expect(tools('hồ sơ của tôi, còn thông báo thì sao')).toEqual([TOOL.MyTickets, TOOL.Notifications])
  })

  it('hai mã khác nhau → hai chi tiết', () => {
    const out = resolveIntents('G-2026-0001 và G-2026-0002', AS, R)
    expect(out.filter((i) => i.kind === 'tool')).toHaveLength(2)
  })

  it('hỏi trùng ý → khử trùng còn một', () => {
    expect(tools('hồ sơ của tôi và danh sách hồ sơ của tôi')).toEqual([TOOL.MyTickets])
  })

  it('tất cả không hiểu → gộp một unknown', () => {
    const out = resolveIntents('abc xyz và qwe rty', AS, R)
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('unknown')
  })

  it('ba ý → ba tool', () => {
    expect(tools('hồ sơ của tôi, thông báo chưa đọc và chi tiết G-2026-0009')).toEqual([
      TOOL.MyTickets,
      TOOL.Notifications,
      TOOL.TicketDetail,
    ])
  })
})
