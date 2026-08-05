import { describe, expect, it } from 'vitest'
import { AssistantRateLimiter } from './rate-limiter'

describe('AssistantRateLimiter — theo user, đếm số tool trong 60s', () => {
  it('cho tới hạn rồi chặn trọn gói', () => {
    let t = 1_000_000
    const rl = new AssistantRateLimiter(5, () => t)
    expect(rl.allow('u', 3)).toBe(true)
    expect(rl.allow('u', 2)).toBe(true) // vừa đủ 5
    expect(rl.allow('u', 1)).toBe(false) // vượt → chặn, không ghi nhận
  })

  it('tách hạn mức theo từng user', () => {
    const t = 1_000_000
    const rl = new AssistantRateLimiter(2, () => t)
    expect(rl.allow('a', 2)).toBe(true)
    expect(rl.allow('a', 1)).toBe(false)
    expect(rl.allow('b', 2)).toBe(true) // user khác không bị ảnh hưởng
  })

  it('lượt cũ hơn 60s được nhả ra', () => {
    let t = 1_000_000
    const rl = new AssistantRateLimiter(2, () => t)
    expect(rl.allow('u', 2)).toBe(true)
    expect(rl.allow('u', 1)).toBe(false)
    t += 61_000
    expect(rl.allow('u', 2)).toBe(true) // cửa sổ đã trôi
  })

  it('cost 0 (toàn unknown) không tiêu hạn mức', () => {
    const rl = new AssistantRateLimiter(1, () => 5)
    expect(rl.allow('u', 0)).toBe(true)
    expect(rl.allow('u', 1)).toBe(true)
  })
})
