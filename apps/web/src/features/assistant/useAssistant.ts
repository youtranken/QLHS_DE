import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ROLE, type Role } from '@qlhs/contracts'
import { t } from '../../i18n'
import { ask, type Block, type Chip } from './api'

export interface Turn {
  id: number
  role: 'user' | 'bot'
  text?: string
  blocks?: Block[]
}

/** Chip khởi tạo theo vai — khớp `defaultSuggestions` của BE, chỉ gợi ý điều đáp
 *  ứng được (không có "đang trễ" vì my_tickets thiếu SLA). `text` (câu truy vấn)
 *  giữ tiếng Việt: intent-engine no-LLM chỉ hiểu tiếng Việt; chỉ `label` i18n. */
export function starterChips(role: Role | null): Chip[] {
  if (role === ROLE.Admin) {
    return [
      { label: t('assistant.starters.adminOverview'), text: 'tổng quan hệ thống' },
      { label: t('assistant.starters.adminStats'), text: 'thống kê tháng này' },
      { label: t('assistant.starters.adminPaused'), text: 'hồ sơ đang tạm dừng SLA' },
    ]
  }
  if (role === ROLE.Dcc1 || role === ROLE.Dcc2 || role === ROLE.Dcc3) {
    return [
      { label: t('assistant.starters.dccMine'), text: 'việc của tôi cần xử lý' },
      { label: t('assistant.starters.dccMap'), text: 'bản đồ tuyến hồ sơ' },
      { label: t('assistant.starters.unread'), text: 'thông báo chưa đọc' },
    ]
  }
  return [
    { label: t('assistant.starters.myTickets'), text: 'hồ sơ của tôi' },
    { label: t('assistant.starters.myOpen'), text: 'hồ sơ của tôi đang mở' },
    { label: t('assistant.starters.unread'), text: 'thông báo chưa đọc' },
  ]
}

export function welcomeFor(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const who = parts.length ? parts.slice(-2).join(' ') : t('assistant.welcomeYou')
  return t('assistant.welcome', { who })
}

export function useAssistant(role: Role | null) {
  const initial = useMemo(() => starterChips(role), [role])
  const [turns, setTurns] = useState<Turn[]>([])
  const [suggestions, setSuggestions] = useState<Chip[]>(initial)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  const inFlight = useRef(false)
  // Token thế hệ: mỗi send/clear tăng token; một ask() cũ resolve sau cl() hoặc
  // sau remount (đổi vai → đổi key) phải BỎ, không tiêm câu trả lời vào hội thoại
  // đã xoá / cây đã gỡ. mountedRef chặn setState sau unmount.
  const gen = useRef(0)
  const mounted = useRef(true)
  useEffect(() => () => void (mounted.current = false), [])

  const send = useCallback(
    async (text: string) => {
      const q = text.trim()
      // Chốt đồng bộ: chặn double-submit trước khi `busy` kịp commit (2 Enter nhanh).
      if (!q || inFlight.current) return
      inFlight.current = true
      const myGen = (gen.current += 1)
      const userId = (seq.current += 1)
      const botId = (seq.current += 1)
      setTurns((prev) => [...prev, { id: userId, role: 'user', text: q }])
      setBusy(true)
      const stale = () => myGen !== gen.current || !mounted.current
      try {
        const r = await ask(q)
        if (stale()) return
        setTurns((prev) => [...prev, { id: botId, role: 'bot', blocks: r.answer.blocks }])
        setSuggestions(r.suggestions.length ? r.suggestions : initial)
      } catch {
        if (stale()) return
        setTurns((prev) => [...prev, { id: botId, role: 'bot', blocks: [{ type: 'empty', text: t('assistant.error') }] }])
      } finally {
        // Chỉ nhả cờ/tắt busy khi vẫn là thế hệ hiện tại — request cũ không được
        // ghi đè trạng thái của send mới sau clear().
        if (!stale()) {
          inFlight.current = false
          setBusy(false)
        }
      }
    },
    [initial],
  )

  /** Xoá đoạn chat, làm mới về trạng thái đầu (client-only, không đụng server).
   *  Tăng token để vô hiệu request đang bay: câu trả lời của nó sẽ bị bỏ. */
  const clear = useCallback(() => {
    gen.current += 1
    inFlight.current = false
    setTurns([])
    setSuggestions(initial)
    setBusy(false)
  }, [initial])

  return { turns, suggestions, busy, send, clear }
}
