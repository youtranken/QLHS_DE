import { useEffect, useRef, useState } from 'react'
import { X, Send, Trash2 } from 'lucide-react'
import { type Role } from '@qlhs/contracts'
import { t } from '../../i18n'
import { openTicketDetail } from '../../shared/route'
import { useAssistant, welcomeFor } from './useAssistant'
import { Mascot } from './Mascot'
import { AnswerCard } from './AnswerCard'
import { SuggestionChips } from './SuggestionChips'
import './assistant.css'

function initials(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const last = parts[parts.length - 1]
  return (last?.[0] ?? 'B').toUpperCase()
}

/** Trợ lý nội bộ (read-only, không LLM). Nút nổi mascot → panel hỏi–đáp. Chip
 *  khởi tạo + lời chào theo vai; kết quả server đã scope theo vai sẵn.
 *  App.tsx key panel theo activeRole → đổi vai remount, chip/hội thoại làm mới. */
export function AssistantPanel({ activeRole = null, userName }: { activeRole?: Role | null; userName?: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const { turns, suggestions, busy, send, clear } = useAssistant(activeRole)
  const bodyRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const firstRun = useRef(true)

  useEffect(() => {
    bodyRef.current?.scrollTo?.(0, bodyRef.current.scrollHeight)
  }, [turns, busy, open])

  // Điều hướng focus: mở → ô nhập; đóng → trả về nút nổi. Bỏ qua lần mount đầu
  // để không cướp focus khi trang vừa tải.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (open) taRef.current?.focus()
    else fabRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function submit(q: string) {
    if (busy || !q.trim()) return
    void send(q)
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }
  function onOpenTicket(c: string) {
    setOpen(false)
    openTicketDetail(c)
  }

  if (!open) {
    return (
      <button ref={fabRef} type="button" className="asst-fab" aria-label={t('assistant.name')} onClick={() => setOpen(true)}>
        <Mascot />
      </button>
    )
  }

  return (
    <section className="asst-panel" role="region" aria-label={t('assistant.name')}>
      <header className="asst-head">
        <span className="asst-ava" aria-hidden>
          <Mascot />
        </span>
        <span className="asst-who">
          <span className="asst-nm">{t('assistant.name')}</span>
          <span className="asst-status">
            <i />
            {t('assistant.online')}
          </span>
        </span>
        <button
          type="button"
          className="asst-iconbtn"
          aria-label={t('assistant.clearChat')}
          title={t('assistant.clearChat')}
          onClick={() => {
            clear()
            taRef.current?.focus()
          }}
          disabled={turns.length === 0}
        >
          <Trash2 size={16} strokeWidth={2} aria-hidden />
        </button>
        <button type="button" className="asst-iconbtn" aria-label={t('assistant.close')} onClick={() => setOpen(false)}>
          <X size={17} strokeWidth={2} aria-hidden />
        </button>
      </header>

      <div className="asst-body" ref={bodyRef} aria-live="polite">
        {turns.length === 0 && (
          <div className="asst-row ai">
            <span className="asst-mava ai" aria-hidden>
              <Mascot />
            </span>
            <div className="asst-bubble">{welcomeFor(userName)}</div>
          </div>
        )}

        {turns.map((tn) =>
          tn.role === 'user' ? (
            <div key={tn.id} className="asst-row me">
              <span className="asst-mava you" aria-hidden>
                {initials(userName)}
              </span>
              <div className="asst-bubble">{tn.text}</div>
            </div>
          ) : (
            <div key={tn.id} className="asst-row ai">
              <span className="asst-mava ai" aria-hidden>
                <Mascot />
              </span>
              <div className="asst-stack">
                {tn.blocks?.map((b, i) => (
                  <AnswerCard key={i} block={b} onOpen={onOpenTicket} />
                ))}
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="asst-row ai">
            <span className="asst-mava ai" aria-hidden>
              <Mascot />
            </span>
            <div className="asst-typing" aria-label={t('assistant.looking')}>
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
      </div>

      <div className="asst-suggest">
        <SuggestionChips chips={suggestions} onPick={submit} />
      </div>

      <form
        className="asst-composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit(text)
        }}
      >
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit(text)
            }
          }}
          placeholder={t('assistant.placeholder')}
          aria-label={t('assistant.questionLabel')}
        />
        <button type="submit" className="asst-send" aria-label={t('assistant.send')} disabled={busy || !text.trim()}>
          <Send size={18} strokeWidth={2} aria-hidden />
        </button>
      </form>
    </section>
  )
}
