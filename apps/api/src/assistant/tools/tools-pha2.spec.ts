import { describe, expect, it, vi } from 'vitest'
import { ROLE } from '@qlhs/contracts'
import { ClosedLookupTool } from './closed-lookup.tool'
import { GetMyWorkboxTool } from './get-my-workbox.tool'
import { GetStationTicketsTool } from './get-station-tickets.tool'
import { GetAnalyticsTool } from './get-analytics.tool'
import { GetPausedTicketsTool } from './get-paused-tickets.tool'
import { type Caller } from '../assistant-tool'

const dcc1: Caller = { sub: 'u1', roles: [ROLE.Dcc1], activeRole: ROLE.Dcc1 }
const dcc2: Caller = { sub: 'u2', roles: [ROLE.Dcc2], activeRole: ROLE.Dcc2 }
const admin: Caller = { sub: 'a', roles: [ROLE.Admin], activeRole: ROLE.Admin }

describe('tools Pha 2 — delegate + scope theo activeRole', () => {
  it('closed_lookup → search-closed(activeRole, {})', async () => {
    const uc = { execute: vi.fn().mockResolvedValue([]) }
    await new ClosedLookupTool(uc as never).run({}, dcc2)
    expect(uc.execute).toHaveBeenCalledWith(ROLE.Dcc2, {})
  })

  it('workbox DCC1 → list-workbox()', async () => {
    const wb = { execute: vi.fn().mockResolvedValue([]) }
    const board = { execute: vi.fn() }
    await new GetMyWorkboxTool(wb as never, board as never).run({}, dcc1)
    expect(wb.execute).toHaveBeenCalledOnce()
    expect(board.execute).not.toHaveBeenCalled()
  })

  it('workbox DCC2 → station-board(activeRole, sub)', async () => {
    const wb = { execute: vi.fn() }
    const board = { execute: vi.fn().mockResolvedValue([]) }
    await new GetMyWorkboxTool(wb as never, board as never).run({}, dcc2)
    expect(board.execute).toHaveBeenCalledWith(ROLE.Dcc2, 'u2')
    expect(wb.execute).not.toHaveBeenCalled()
  })

  it('station tickets → execute(status, activeRole, flow?)', async () => {
    const uc = { execute: vi.fn().mockResolvedValue([]) }
    await new GetStationTicketsTool(uc as never).run({ status: 'Received by DCC2', flow: 'Contract' }, dcc2)
    expect(uc.execute).toHaveBeenCalledWith('Received by DCC2', ROLE.Dcc2, 'Contract')
  })

  it('analytics → execute("week") khi period=week', async () => {
    const uc = { execute: vi.fn().mockResolvedValue({}) }
    await new GetAnalyticsTool(uc as never).run({ period: 'week' }, admin)
    expect(uc.execute).toHaveBeenCalledWith('week')
  })

  it('paused → execute() không tham số', async () => {
    const uc = { execute: vi.fn().mockResolvedValue({ open: [] }) }
    await new GetPausedTicketsTool(uc as never).run()
    expect(uc.execute).toHaveBeenCalledOnce()
  })
})
