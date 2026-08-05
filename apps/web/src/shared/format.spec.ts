import { describe, expect, it } from 'vitest'
import { groupAmount } from './format'

describe('groupAmount', () => {
  it('nhóm nghìn theo dấu chấm cho VND (mặc định)', () => {
    expect(groupAmount('3480500000')).toBe('3.480.500.000')
    expect(groupAmount('5000000', 'VND')).toBe('5.000.000')
  })

  it('nhóm nghìn theo dấu phẩy cho USD (chuẩn quốc tế)', () => {
    expect(groupAmount('12750000', 'USD')).toBe('12,750,000')
  })

  it('giữ nguyên chuỗi rỗng / null / không phải số', () => {
    expect(groupAmount('')).toBe('')
    expect(groupAmount(null)).toBe('')
    expect(groupAmount(undefined)).toBe('')
    expect(groupAmount('1.2e3', 'VND')).toBe('1.2e3')
  })
})
