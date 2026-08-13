import { describe, it, expect } from 'vitest'
import { parseSuppressList, isSuppressed } from './suppress-list'

describe('mail suppress-list', () => {
  it('mặc định chặn 3 tài khoản admin khi env trống', () => {
    const list = parseSuppressList(undefined)
    expect(isSuppressed('admin1@pmh.com.vn', list)).toBe(true)
    expect(isSuppressed('admin2@pmh.com.vn', list)).toBe(true)
    expect(isSuppressed('admin3@pmh.com.vn', list)).toBe(true)
  })

  it('không chặn địa chỉ ngoài danh sách', () => {
    const list = parseSuppressList(undefined)
    expect(isSuppressed('user@pmh.com.vn', list)).toBe(false)
  })

  it('so khớp bất kể hoa/thường và khoảng trắng', () => {
    const list = parseSuppressList('  Admin1@PMH.com.vn ')
    expect(isSuppressed('ADMIN1@pmh.com.vn', list)).toBe(true)
  })

  it('env tùy biến thay hoàn toàn danh sách mặc định', () => {
    const list = parseSuppressList('noreply@pmh.com.vn')
    expect(isSuppressed('noreply@pmh.com.vn', list)).toBe(true)
    expect(isSuppressed('admin1@pmh.com.vn', list)).toBe(false)
  })

  it('bỏ qua mục rỗng khi phẩy thừa', () => {
    const list = parseSuppressList('a@x.com,, ,b@x.com')
    expect(list.size).toBe(2)
  })

  it('bóc địa chỉ từ dạng "Tên <email>"', () => {
    const list = parseSuppressList(undefined)
    expect(isSuppressed('Admin Một <admin1@pmh.com.vn>', list)).toBe(true)
  })

  it('nhiều người nhận: chỉ chặn khi TẤT CẢ đều bị chặn', () => {
    const list = parseSuppressList(undefined)
    expect(isSuppressed('admin1@pmh.com.vn, admin2@pmh.com.vn', list)).toBe(true)
    // Một người nhận hợp lệ → không bỏ (không nuốt mail của người khác).
    expect(isSuppressed('admin1@pmh.com.vn, user@pmh.com.vn', list)).toBe(false)
  })

  it('chuỗi rỗng → không chặn', () => {
    const list = parseSuppressList(undefined)
    expect(isSuppressed('', list)).toBe(false)
  })
})
