import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { PRIORITY } from '@qlhs/contracts'
import { t } from '../../i18n'
import { Select } from '../../shared/Select'
import type { BoardFilter } from './boardFilter'
import { isViewActive, loadViews, removeView, saveViews, upsertView, type SavedView } from './boardViews'

const FLOW_OPTS = ['All', 'Contract', 'Payment', 'General'] as const
// Priority filter is a compact dropdown: "Tất cả" (default) → Gấp / Thường.
// "Khẩn" (Urgent) dropped from the picker.
const PRIO_OPTS = [
  { v: 'All', k: 'board.filter.all' },
  { v: PRIORITY.Rush, k: 'board.card.prioRush' },
  { v: PRIORITY.Normal, k: 'board.card.prioNormal' },
] as const

/**
 * Board facets (flow — DCC1 only — + priority) plus FR #9 "saved views": persist
 * the current filter under a name and re-apply it in one click. Kept out of
 * StationBoard so that file stays under the granularity ceiling.
 */
export function BoardFilterBar({
  canManage,
  filter,
  onFlow,
  onPriority,
  onApplyView,
}: {
  canManage: boolean
  filter: BoardFilter
  onFlow: (v: string) => void
  onPriority: (v: string) => void
  onApplyView: (f: BoardFilter) => void
}) {
  const [views, setViews] = useState<SavedView[]>([])
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => setViews(loadViews()), [])

  const persist = (next: SavedView[]) => {
    setViews(next)
    saveViews(next)
  }
  const save = () => {
    const next = upsertView(views, name, filter)
    if (next !== views) persist(next)
    setName('')
    setNaming(false)
  }

  return (
    <div className="boardfilters">
      {canManage && (
        <div className="fgrp" role="group" aria-label={t('board.filter.flowLabel')}>
          {FLOW_OPTS.map((fl) => (
            <button key={fl} type="button" aria-pressed={filter.flow === fl} className={`fchip${filter.flow === fl ? ' on' : ''}`} onClick={() => onFlow(fl)}>
              {fl === 'All' ? t('board.filter.all') : <span lang="en">{fl}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="fgrp priofilter">
        <Select
          value={filter.priority}
          onChange={onPriority}
          options={PRIO_OPTS.map((p) => ({ value: p.v, label: t(p.k) }))}
          ariaLabel={t('board.filter.priorityLabel')}
          className="priosel"
        />
      </div>

      <div className="fgrp views" role="group" aria-label={t('board.views.label')}>
        {views.map((v) => (
          <span key={v.name} className={`viewchip${isViewActive(v, filter) ? ' on' : ''}`}>
            <button type="button" className="apply" onClick={() => onApplyView(v.filter)}>
              {v.name}
            </button>
            <button type="button" className="del" aria-label={t('board.views.delete', { name: v.name })} onClick={() => persist(removeView(views, v.name))}>
              <X size={12} aria-hidden />
            </button>
          </span>
        ))}
        {naming ? (
          <span className="viewsave">
            <input
              autoFocus
              value={name}
              maxLength={40}
              placeholder={t('board.views.namePlaceholder')}
              aria-label={t('board.views.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                else if (e.key === 'Escape') { setNaming(false); setName('') }
              }}
            />
            <button type="button" className="fchip on" onClick={save} disabled={!name.trim()}>
              {t('board.views.confirmSave')}
            </button>
          </span>
        ) : (
          <button type="button" className="fchip addview" onClick={() => setNaming(true)}>
            {t('board.views.save')}
          </button>
        )}
      </div>
    </div>
  )
}
