import { describe, expect, it, vi } from 'vitest'
import { ROLE } from '@qlhs/contracts'
import { GetMyTicketsTool } from './get-my-tickets.tool'
import { GetTicketDetailTool } from './get-ticket-detail.tool'
import { WhatsNextTool } from './whats-next.tool'
import { GetMyNotificationsTool } from './get-my-notifications.tool'
import { type Caller } from '../assistant-tool'

const CALLER: Caller = { sub: 'lan', roles: [ROLE.Dcc2], activeRole: ROLE.Dcc2 }

describe('tools — delegate đúng use-case với danh tính từ caller', () => {
  it('get_my_tickets → list-my-tickets(sub)', async () => {
    const uc = { execute: vi.fn().mockResolvedValue([]) }
    await new GetMyTicketsTool(uc as never).run({}, CALLER)
    expect(uc.execute).toHaveBeenCalledWith('lan')
  })

  it('get_ticket_detail → ticket-detail(code, {activeRole, sub}, {markSeen:false})', async () => {
    const uc = { execute: vi.fn().mockResolvedValue({}) }
    await new GetTicketDetailTool(uc as never).run({ code: 'G-2026-0001' }, CALLER)
    // read-only: chỉ hỏi chi tiết KHÔNG được đánh dấu đã xem (như whats_next).
    expect(uc.execute).toHaveBeenCalledWith('G-2026-0001', { role: ROLE.Dcc2, sub: 'lan' }, { markSeen: false })
  })

  it('whats_next dùng CÙNG ticket-detail use-case (không legal-actions trần)', async () => {
    const uc = { execute: vi.fn().mockResolvedValue({ actions: [] }) }
    await new WhatsNextTool(uc as never).run({ code: 'CT-2026-0002' }, CALLER)
    // markSeen:false — chỉ hỏi bước tiếp, không đánh dấu đã xem (review D2).
    expect(uc.execute).toHaveBeenCalledWith('CT-2026-0002', { role: ROLE.Dcc2, sub: 'lan' }, { markSeen: false })
  })

  it('get_my_notifications → list-notifications(sub, roles[])', async () => {
    const uc = { execute: vi.fn().mockResolvedValue({ items: [], unread: 0 }) }
    await new GetMyNotificationsTool(uc as never).run({}, CALLER)
    expect(uc.execute).toHaveBeenCalledWith('lan', [ROLE.Dcc2])
  })
})
