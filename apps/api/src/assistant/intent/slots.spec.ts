import { describe, expect, it } from 'vitest'
import { FLOW, TICKET_STATUS } from '@qlhs/contracts'
import { extractSlots, fold, hasPhrase } from './slots'

describe('fold — bỏ dấu tiếng Việt để so khớp', () => {
  it('bỏ dấu + hạ thường + đ→d', () => {
    expect(fold('Hồ sơ Đã Trễ')).toBe('ho so da tre')
  })
})

describe('hasPhrase — khớp cụm như token, không dính chữ khác', () => {
  it('khớp "tre" trong "ho so tre" nhưng KHÔNG khớp trong "tren ban"', () => {
    expect(hasPhrase('ho so tre', 'tre')).toBe(true)
    expect(hasPhrase('tren ban', 'tre')).toBe(false)
  })
})

describe('extractSlots — mã hồ sơ', () => {
  it('bắt G-2026-0001 và chuẩn hoá hoa', () => {
    expect(extractSlots('xem hồ sơ g-2026-0001 nhé').code).toBe('G-2026-0001')
  })
  it('bắt CT-2026-0123', () => {
    expect(extractSlots('CT-2026-0123').code).toBe('CT-2026-0123')
  })
  it('KHÔNG nhầm một năm trần thành mã', () => {
    expect(extractSlots('báo cáo năm 2026').code).toBeUndefined()
  })
})

describe('extractSlots — flow (đã bỏ bẫy "chung")', () => {
  it('"thanh toán" → Payment', () => {
    expect(extractSlots('hồ sơ thanh toán').flow).toBe(FLOW.Payment)
  })
  it('"hợp đồng" → Contract', () => {
    expect(extractSlots('luồng hợp đồng').flow).toBe(FLOW.Contract)
  })
  it('"nói chung" KHÔNG bị nhận là General', () => {
    expect(extractSlots('nói chung là vậy').flow).toBeUndefined()
  })
})

describe('extractSlots — bộ lọc & trạng thái', () => {
  it('"trễ hạn" → overdue', () => {
    expect(extractSlots('hồ sơ trễ hạn').overdue).toBe(true)
  })
  it('"gấp" → urgent', () => {
    expect(extractSlots('có gì gấp không').urgent).toBe(true)
  })
  it('"chưa đọc" → unread', () => {
    expect(extractSlots('thông báo chưa đọc').unread).toBe(true)
  })
  it('"đang mở" → openOnly=true', () => {
    expect(extractSlots('hồ sơ đang mở').openOnly).toBe(true)
  })
  it('"hoàn tất" → status Completed', () => {
    expect(extractSlots('hồ sơ đã hoàn tất').status).toBe(TICKET_STATUS.Completed)
  })
})
