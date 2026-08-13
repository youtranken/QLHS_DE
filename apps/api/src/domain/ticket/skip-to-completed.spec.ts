import { describe, it, expect } from 'vitest'
import { FLOW, TICKET_STATUS } from '@qlhs/contracts'
import { findEdge } from './state-machine/index'
import { SKIP_TO_COMPLETED_STEPS, SKIP_COMPLETED_REASON } from './skip-to-completed'

describe('SKIP_TO_COMPLETED_STEPS', () => {
  it('là một đường đi HỢP LỆ Received by DCC2 → Completed trên luồng Contract', () => {
    let status = TICKET_STATUS.ReceivedByDcc2
    for (const step of SKIP_TO_COMPLETED_STEPS) {
      const edge = findEdge(status, step.event, FLOW.Contract)
      expect(edge, `thiếu cạnh ${status} --${step.event}-->`).toBeDefined()
      status = edge!.to
    }
    expect(status).toBe(TICKET_STATUS.Completed)
  })

  it('mỗi bước khai đúng vai chủ (ownerRole) của cạnh — để qua guard AD-2 khi chạy hộ', () => {
    let status = TICKET_STATUS.ReceivedByDcc2
    for (const step of SKIP_TO_COMPLETED_STEPS) {
      const edge = findEdge(status, step.event, FLOW.Contract)!
      expect(edge.ownerRole, `sai vai ở bước ${step.event}`).toBe(step.role)
      status = edge.to
    }
  })

  it('bắt đầu bằng sendToAccounting và kết bằng completeContract', () => {
    expect(SKIP_TO_COMPLETED_STEPS[0]!.event).toBe('sendToAccounting')
    expect(SKIP_TO_COMPLETED_STEPS.at(-1)!.event).toBe('completeContract')
  })

  it('ghi chú skip khớp chuỗi người dùng yêu cầu', () => {
    expect(SKIP_COMPLETED_REASON).toBe('Skip to Completed')
  })
})
