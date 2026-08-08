import { useEffect, useRef } from 'react'

/** Idle mặc định 15' — khớp session_idle_seconds (900s) của PMH ID / QLTS. */
const IDLE_MS = 15 * 60 * 1000
const ACTIVITY = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const

/**
 * Đăng xuất khi KHÔNG có tương tác người dùng trong `idleMs`. Cần vì QLHS có poll
 * ngầm (useLiveRefetch, 30s) + SSE → cứ refresh token nên phiên PMH ID không tự
 * idle-out như QLTS (QLTS không poll → idle chạm ở IdP). Đây đếm idle theo tương
 * tác THẬT ở client rồi gọi logout để đóng phiên server. `enabled=false` (chưa
 * đăng nhập) thì không đếm. onIdle đọc qua ref → không re-arm timer mỗi lần render.
 */
export function useIdleLogout(onIdle: () => void, enabled: boolean, idleMs = IDLE_MS): void {
  const cb = useRef(onIdle)
  cb.current = onIdle
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => cb.current(), idleMs)
    }
    for (const ev of ACTIVITY) window.addEventListener(ev, reset, { passive: true })
    reset()
    return () => {
      clearTimeout(timer)
      for (const ev of ACTIVITY) window.removeEventListener(ev, reset)
    }
  }, [enabled, idleMs])
}
