import { useCallback, useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Info, Pencil, Plus, X } from 'lucide-react'
import { t } from '../../i18n'
import { ConfirmModal } from '../../shared/ConfirmModal'
import { StateNotice } from '../../shared/StateNotice'
import { toast } from '../../shared/toast'
import { createOption, listOptions, updateOption, type OptionView } from './api'
import { AdminDocTypes } from './AdminDocTypes'

/** Hàm (không const) để nhãn t() đọc lại catalog mỗi render — sẵn cho đổi ngôn ngữ. */
const kinds = () => [
  { key: 'docType', label: t('adminOptions.kinds.docType') },
  { key: 'paymentTerm', label: t('adminOptions.kinds.paymentTerm') },
  { key: 'projectTeam', label: t('adminOptions.kinds.projectTeam') },
  { key: 'currency', label: t('adminOptions.kinds.currency') },
]

export function AdminOptions() {
  const [kind, setKind] = useState<string>('docType')
  const [rows, setRows] = useState<OptionView[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [addValue, setAddValue] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmOff, setConfirmOff] = useState<OptionView | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    // Tab Document Type có dữ liệu riêng (AdminDocTypes tự tải) — không gọi listOptions.
    if (kind === 'docType') {
      setRows(null)
      setError(false)
      return
    }
    setError(false)
    try {
      setRows(await listOptions(kind))
    } catch {
      setError(true)
    }
  }, [kind])

  useEffect(() => {
    void load()
  }, [load])

  const kindLabel = kinds().find((k) => k.key === kind)?.label ?? kind
  const isDocType = kind === 'docType'

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    const value = addValue.trim()
    if (!value) return
    try {
      await createOption(kind, value)
      setAddValue('')
      setAdding(false)
      await load()
      toast.ok(t('adminOptions.addedToast', { value }))
    } catch {
      toast.err(t('adminOptions.addFail'))
    }
  }

  async function saveEdit(id: string) {
    const value = editValue.trim()
    if (!value) return
    try {
      await updateOption(id, { value })
      setEditId(null)
      await load()
      toast.ok(t('adminOptions.renamedToast'))
    } catch {
      toast.err(t('adminOptions.saveFail'))
    }
  }

  async function setActive(row: OptionView, active: boolean) {
    try {
      await updateOption(row.id, { active })
      await load()
      toast.ok(t(active ? 'adminOptions.enabledToast' : 'adminOptions.disabledToast', { value: row.value }))
    } catch {
      toast.err(t('adminOptions.saveFail'))
    }
  }

  return (
    <section aria-label={t('adminOptions.title')}>
      <h1 className="sr-only">{t('adminOptions.title')}</h1>
      {!isDocType && (
        <div className="pagehead" style={{ marginTop: 0, justifyContent: 'flex-end' }}>
          <button type="button" className="btn primary" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden />
            {t('adminOptions.addBtn')}
          </button>
        </div>
      )}

      <div className="cat-toolbar">
        <div className="segmented" role="tablist" aria-label={t('adminOptions.kindsAria')}>
          {kinds().map((k) => (
            <button
              key={k.key}
              type="button"
              role="tab"
              aria-selected={kind === k.key}
              className={kind === k.key ? 'seg active' : 'seg'}
              onClick={() => {
                setKind(k.key)
                setEditId(null)
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {isDocType ? (
        <AdminDocTypes />
      ) : (
        <>
      <div className="note-bar">
        <Info size={18} aria-hidden />
        {t('adminOptions.note')}
      </div>

      {error ? (
        <StateNotice kind="error" text={t('adminOptions.loadError')} onRetry={load} />
      ) : !rows ? (
        <StateNotice kind="loading" text={t('adminOptions.loading')} />
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-ic">
              <Plus size={26} aria-hidden />
            </div>
            <div className="empty-title">{t('adminOptions.emptyTitle')}</div>
            <div className="empty-help">{t('adminOptions.emptyHelp', { kind: kindLabel })}</div>
            <button type="button" className="btn primary" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden />
              {t('adminOptions.addBtn')}
            </button>
          </div>
        </div>
      ) : (
        <div className="card table-card">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{t('adminOptions.th.order')}</th>
                <th scope="col">{t('adminOptions.th.value')}</th>
                <th scope="col">{t('adminOptions.th.usedCount')}</th>
                <th scope="col">{t('adminOptions.th.state')}</th>
                <th scope="col">{t('adminOptions.th.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r, i) => (
                <tr key={r.id} className={r.active ? undefined : 'off'}>
                  <td data-label={t('adminOptions.th.order')}>
                    <span className="ord">{String(i + 1).padStart(2, '0')}</span>
                  </td>
                  <td data-label={t('adminOptions.th.value')}>
                    {editId === r.id ? (
                      <span className="cat-edit">
                        <input
                          autoFocus
                          className="txt-input mono"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveEdit(r.id)
                            if (e.key === 'Escape') setEditId(null)
                          }}
                          aria-label={t('adminOptions.editAria')}
                        />
                        <button type="button" className="btn primary sm" onClick={() => void saveEdit(r.id)}>
                          {t('adminOptions.save')}
                        </button>
                        <button type="button" className="btn ghost sm" onClick={() => setEditId(null)}>
                          {t('adminOptions.cancel')}
                        </button>
                      </span>
                    ) : (
                      <span className="cat-val">
                        <span className="val-text">{r.value}</span>
                        {!r.active && <span className="pill closed">{t('adminOptions.offChip')}</span>}
                      </span>
                    )}
                  </td>
                  <td data-label={t('adminOptions.th.usedCount')}>
                    <span className="usage">
                      <span className="n">{r.usedBy}</span>
                      <span className="u">{t('adminOptions.usedUnit')}</span>
                    </span>
                  </td>
                  <td data-label={t('adminOptions.th.state')}>
                    <span className="state-cell">
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={r.active}
                          aria-label={t(r.active ? 'adminOptions.switchOffAria' : 'adminOptions.switchOnAria', { value: r.value })}
                          onChange={() => (r.active ? setConfirmOff(r) : void setActive(r, true))}
                        />
                        <span className="track" aria-hidden />
                        <span className="knob" aria-hidden />
                      </label>
                      <span className="state-lbl">{r.active ? t('adminOptions.on') : t('adminOptions.off')}</span>
                    </span>
                  </td>
                  <td data-label={t('adminOptions.th.actions')}>
                    {editId !== r.id && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => {
                          setEditId(r.id)
                          setEditValue(r.value)
                        }}
                      >
                        <Pencil size={14} aria-hidden />
                        {t('adminOptions.edit')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      <Dialog.Root
        open={adding}
        onOpenChange={(o) => {
          setAdding(o)
          if (!o) setAddValue('')
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="aa-overlay" />
          {/* adminshell here re-exposes the .adminshell-scoped kit (btn/txt-input/field)
              to the portalled dialog; .aa-modal's `background` shorthand (loaded after
              the token layer) resets the canvas paint, so no gradient bleeds in. */}
          <Dialog.Content className="aa-modal adminshell cat-modal" aria-describedby={undefined}>
            <div className="aa-modal-accent" />
            <form onSubmit={submitAdd}>
              <div className="aa-modal-head">
                <div>
                  <Dialog.Title className="aa-modal-title">{t('adminOptions.addModalTitle')}</Dialog.Title>
                  <div className="aa-modal-sub">{kindLabel}</div>
                </div>
                <Dialog.Close asChild>
                  <button type="button" className="row-menu" aria-label={t('adminOptions.close')}>
                    <X size={18} aria-hidden />
                  </button>
                </Dialog.Close>
              </div>
              <div className="aa-modal-body">
                <div className="field">
                  <label htmlFor="cat-add-value">{t('adminOptions.valueLabel')}</label>
                  <input
                    id="cat-add-value"
                    autoFocus
                    className="txt-input mono"
                    placeholder={t('adminOptions.addPlaceholder')}
                    value={addValue}
                    onChange={(e) => setAddValue(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="aa-modal-foot">
                <button type="button" className="btn ghost" onClick={() => setAdding(false)}>
                  {t('adminOptions.cancel')}
                </button>
                <button type="submit" className="btn primary">
                  {t('adminOptions.save')}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {confirmOff && (
        <ConfirmModal
          title={t('adminOptions.confirmOffTitle')}
          message={t('adminOptions.confirmOffMessage')}
          code={confirmOff.value}
          danger
          confirmLabel={t('adminOptions.confirmOffLabel')}
          onConfirm={async () => {
            const row = confirmOff
            setConfirmOff(null)
            await setActive(row, false)
          }}
          onCancel={() => setConfirmOff(null)}
        />
      )}
    </section>
  )
}
