import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { useAnchoredMenu } from '../../shared/useAnchoredMenu'

export interface DocTypeGroupOption {
  flow: string
  types: string[]
}

/**
 * Document Type picker — mở ra chỉ thấy cột LUỒNG (trái); chọn/di vào một luồng thì
 * cột LOẠI (phải) mới bung ra như mở trang sách (rotateY từ gáy trái). ✓ đánh dấu
 * loại đang chọn. Bàn phím: ↑/↓ chuyển luồng; →/Enter mở cột loại; trong cột loại
 * ↑/↓ chọn loại, ← quay lại cột luồng, Enter chốt, Esc đóng. Style theo token app.
 */
export function DocTypePicker({
  value,
  onChange,
  groups,
  ariaLabel,
  placeholder = '—',
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  groups: DocTypeGroupOption[]
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [col, setCol] = useState<'flows' | 'types'>('flows')
  const flowOf = useMemo(
    () => groups.find((g) => g.types.includes(value))?.flow ?? groups[0]?.flow ?? '',
    [groups, value],
  )
  const [activeFlow, setActiveFlow] = useState(flowOf)
  const [typeIdx, setTypeIdx] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { refs, floatingStyles } = useAnchoredMenu(open, { maxHeight: 300 })

  const flowIdx = Math.max(0, groups.findIndex((g) => g.flow === activeFlow))
  const types = groups[flowIdx]?.types ?? []

  // Mở ra → gập lại cột phải, con trỏ ở cột luồng, trỏ vào luồng của giá trị hiện tại.
  useEffect(() => {
    if (!open) return
    setExpanded(false)
    setCol('flows')
    setActiveFlow(flowOf)
    const g = groups.find((x) => x.flow === flowOf)
    setTypeIdx(Math.max(0, g?.types.indexOf(value) ?? 0))
  }, [open, flowOf, groups, value])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (refs.domReference.current?.contains(target) || refs.floating.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, refs.domReference, refs.floating])

  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
    triggerRef.current?.focus()
  }
  // Bung cột loại của một luồng (mở trang sách). Luồng CHỈ 1 loại → chọn thẳng,
  // khỏi bung cột phải (không có gì để chọn thêm).
  const openFlow = (flow: string, focusTypes = false) => {
    const g = groups.find((x) => x.flow === flow)
    if (!g || g.types.length === 0) return
    if (g.types.length === 1) return choose(g.types[0]!)
    setActiveFlow(flow)
    setExpanded(true)
    setTypeIdx(Math.max(0, g.types.indexOf(value)))
    if (focusTypes) setCol('types')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.stopPropagation()
      return setOpen(false)
    }
    if (col === 'flows') {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = groups[flowIdx + (e.key === 'ArrowDown' ? 1 : -1)]
        if (next) setActiveFlow(next.flow) // chỉ đổi highlight, chưa bung cột phải
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        openFlow(activeFlow, true)
      }
    } else {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setTypeIdx((i) => Math.min(types.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setTypeIdx((i) => Math.max(0, i - 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCol('flows') // quay lại cột luồng (trang vẫn mở)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (types[typeIdx]) choose(types[typeIdx])
      }
    }
  }

  return (
    <div className="fsel" ref={refs.setReference}>
      <button
        ref={triggerRef}
        type="button"
        className="fsel-trigger"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className={value ? 'fsel-val' : 'fsel-val ph'}>{value || placeholder}</span>
        <svg className="fsel-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            className={`fsel-menu dtpk-menu${expanded ? ' expanded' : ''}`}
            style={floatingStyles}
            ref={refs.setFloating}
          >
            <div className="dtpk-flows" role="tablist">
              {groups.map((g, gi) => (
                <button
                  key={g.flow}
                  type="button"
                  role="tab"
                  aria-selected={g.flow === activeFlow}
                  className={`dtpk-flow${g.flow === activeFlow ? ' on' : ''}`}
                  onClick={() => openFlow(g.flow, true)}
                >
                  <span className="dtpk-tag" aria-hidden>
                    {String.fromCharCode(65 + gi)}
                  </span>
                  <span className="dtpk-flow-name" lang="en">
                    {g.flow}
                  </span>
                  <span className="dtpk-cnt">{g.types.length}</span>
                </button>
              ))}
            </div>
            <div className="dtpk-right" aria-hidden={!expanded}>
              {/* key theo luồng → đổi luồng thì "trang" remount, chạy lại animation lật trang. */}
              <ul key={activeFlow} className="dtpk-types" role="listbox">
                {types.map((tp, i) => (
                  <li key={tp}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={tp === value}
                      tabIndex={-1}
                      className={`fsel-option${col === 'types' && i === typeIdx ? ' active' : ''}${tp === value ? ' sel' : ''}`}
                      onMouseEnter={() => {
                        setCol('types')
                        setTypeIdx(i)
                      }}
                      onClick={() => choose(tp)}
                    >
                      <span className="fsel-opt-label" lang="en">
                        {tp}
                      </span>
                      {tp === value && <Check className="fsel-check" size={15} aria-hidden />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
