import { describe, expect, it } from 'vitest'
import { ROLE, type Role } from '@qlhs/contracts'
import { resolveIntent } from './resolve-intent'
import { TOOL } from './types'

function pick(text: string, role: Role): string {
  const i = resolveIntent(text, role, [role])
  return i.kind === 'tool' ? i.tool : i.kind
}

describe('resolveIntent — lọc theo activeRole (Pha 2, không lộ tool ngoài quyền)', () => {
  it('Applicant hỏi "thống kê" → unknown, KHÔNG chạm analytics', () => {
    expect(pick('thống kê tháng này', ROLE.Applicant)).toBe('unknown')
  })
  it('Admin hỏi "thống kê" → analytics', () => {
    expect(pick('thống kê tháng này', ROLE.Admin)).toBe(TOOL.Analytics)
  })
  it('Admin "tổng quan hệ thống" → overview', () => {
    expect(pick('tổng quan hệ thống', ROLE.Admin)).toBe(TOOL.Overview)
  })
  it('Admin "đang tạm dừng SLA" → paused', () => {
    expect(pick('đang tạm dừng SLA', ROLE.Admin)).toBe(TOOL.Paused)
  })
  it('Applicant "đang tạm dừng SLA" → unknown (paused là Admin)', () => {
    expect(pick('đang tạm dừng SLA', ROLE.Applicant)).toBe('unknown')
  })
  it('DCC1 "việc của tôi cần xử lý" → workbox', () => {
    expect(pick('việc của tôi cần xử lý', ROLE.Dcc1)).toBe(TOOL.Workbox)
  })
  it('Applicant "việc của tôi" → my_tickets (workbox bị chặn, rơi xuống)', () => {
    expect(pick('việc của tôi', ROLE.Applicant)).toBe(TOOL.MyTickets)
  })
  it('DCC2 "bản đồ tuyến" → dispatch_map', () => {
    expect(pick('bản đồ tuyến hồ sơ', ROLE.Dcc2)).toBe(TOOL.DispatchMap)
  })
  it('DCC1 "nhật ký thao tác" → unknown (audit là Admin)', () => {
    expect(pick('nhật ký thao tác gần đây', ROLE.Dcc1)).toBe('unknown')
  })
})
