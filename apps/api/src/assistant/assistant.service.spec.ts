import { describe, expect, it } from 'vitest'
import { ROLE } from '@qlhs/contracts'
import { AssistantService } from './assistant.service'
import { TOOL } from './intent/types'
import { TicketNotFoundError } from '../domain/errors'
import { type AssistantTool, type Caller } from './assistant-tool'

const CALLER: Caller = { sub: 'a', roles: [ROLE.Applicant], activeRole: ROLE.Applicant }

function tool(name: string, run: AssistantTool['run']): AssistantTool {
  return { name, activeRoles: [ROLE.Applicant], run }
}

class FakeRegistry {
  private readonly map: Record<string, AssistantTool>
  constructor(tools: AssistantTool[]) {
    this.map = Object.fromEntries(tools.map((t) => [t.name, t]))
  }
  find(name: string) {
    return this.map[name]
  }
  forActiveRole() {
    return Object.values(this.map)
  }
}

const ALLOW = { allow: () => true }
const DENY = { allow: () => false }

function service(tools: AssistantTool[], limiter: { allow: () => boolean } = ALLOW): AssistantService {
  return new AssistantService(new FakeRegistry(tools) as never, limiter as never)
}

describe('AssistantService — điều phối intent → tool → render', () => {
  it('một ý: "hồ sơ của tôi" gọi tool và render bảng', async () => {
    const svc = service([
      tool(TOOL.MyTickets, () =>
        Promise.resolve([{ code: 'G-2026-0001', flow: 'General', status: 'Submitted', priority: 'normal' }]),
      ),
    ])
    const { answer } = await svc.ask(CALLER, 'hồ sơ của tôi')
    expect(answer.blocks).toHaveLength(1)
    expect(answer.blocks[0]).toMatchObject({ type: 'ticketList' })
  })

  it('nhiều ý: hai tool → hai block, đúng thứ tự', async () => {
    const svc = service([
      tool(TOOL.MyTickets, () => Promise.resolve([])),
      tool(TOOL.Notifications, () => Promise.resolve({ items: [], unread: 0 })),
    ])
    const { answer } = await svc.ask(CALLER, 'hồ sơ của tôi và thông báo chưa đọc')
    expect(answer.blocks).toHaveLength(2)
    expect(answer.blocks[0].type).toBe('empty') // không có hồ sơ
    expect(answer.blocks[1].type).toBe('empty') // không có thông báo
  })

  it('một ý lỗi (không thấy/không quyền) → block mềm, không ném', async () => {
    const svc = service([
      tool(TOOL.TicketDetail, () => Promise.reject(new TicketNotFoundError('x'))),
    ])
    const { answer } = await svc.ask(CALLER, 'chi tiết G-2026-0009')
    expect(answer.blocks[0]).toMatchObject({ type: 'empty' })
    expect((answer.blocks[0] as { text: string }).text).toContain('G-2026-0009')
  })

  it('không hiểu → block text + gợi ý chip', async () => {
    const svc = service([])
    const { answer, suggestions } = await svc.ask(CALLER, 'thời tiết hôm nay')
    expect(answer.blocks[0].type).toBe('text')
    expect(suggestions.length).toBeGreaterThan(0)
  })

  it('unknown đứng đầu KHÔNG làm rớt tool thứ 4 (review P1)', async () => {
    const admin: Caller = { sub: 'x', roles: [ROLE.Admin], activeRole: ROLE.Admin }
    const overview = { users: { total: 0, appointed: 0, unappointed: 0 }, runningTotal: 0, overdueTotal: 0, auditToday: 0, lines: [], recent: [], mailPending: 0, pausedTotal: 0 }
    const analytics = { granularity: 'month', flows: [], dwell: [], throughput: [], returns: [], topOverdue: [] }
    const svc = service([
      { name: TOOL.MyTickets, activeRoles: [ROLE.Admin], run: () => Promise.resolve([]) },
      { name: TOOL.Notifications, activeRoles: [ROLE.Admin], run: () => Promise.resolve({ items: [], unread: 0 }) },
      { name: TOOL.Overview, activeRoles: [ROLE.Admin], run: () => Promise.resolve(overview) },
      { name: TOOL.Analytics, activeRoles: [ROLE.Admin], run: () => Promise.resolve(analytics) },
    ])
    const { answer } = await svc.ask(admin, 'khongbiet? hồ sơ của tôi; thông báo; tổng quan; thống kê')
    // 1 unknown (text) + 4 tool block → tool cuối (analytics=stats) không bị bỏ.
    expect(answer.blocks).toHaveLength(5)
    expect(answer.blocks[4].type).toBe('stats')
  })

  it('vượt rate-limit → block mềm, không chạy tool', async () => {
    let ran = false
    const svc = service(
      [{ name: TOOL.MyTickets, activeRoles: [ROLE.Applicant], run: () => { ran = true; return Promise.resolve([]) } }],
      DENY,
    )
    const { answer } = await svc.ask(CALLER, 'hồ sơ của tôi')
    expect(ran).toBe(false)
    expect((answer.blocks[0] as { text: string }).text).toContain('hơi nhanh')
  })
})
