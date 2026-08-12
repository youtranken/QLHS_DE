import { useCallback, useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Eye, EyeOff, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { FLOW } from '@qlhs/contracts'
import {
  addDocumentType,
  deleteDocType,
  getAdminDocTypes,
  setDocTypeActive,
  type AdminDocType,
  type AdminDocTypeGroup,
} from './api'
import { ConfirmModal } from '../../shared/ConfirmModal'
import { StateNotice } from '../../shared/StateNotice'
import { Select } from '../../shared/Select'
import { toast } from '../../shared/toast'
import { t } from '../../i18n'

const FLOWS: readonly string[] = Object.values(FLOW)

/** Danh mục › Document Type: liệt kê loại theo luồng + THÊM mới (kèm luồng). Ẩn/bật
 *  lại (mềm, hoàn tác) để gỡ khỏi form tạo hồ sơ; xoá HẲN chỉ khi chưa hồ sơ nào dùng
 *  (BE chặn usedBy>0) — hồ sơ cũ lưu text nên xoá loại đang dùng sẽ hỏng suy luồng. */
export function AdminDocTypes() {
  const [groups, setGroups] = useState<AdminDocTypeGroup[] | null>(null)
  const [error, setError] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [value, setValue] = useState('')
  const [flow, setFlow] = useState<string>(FLOWS[0] ?? 'General')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<AdminDocType | null>(null)

  const load = useCallback(async () => {
    setError(false)
    try {
      setGroups(await getAdminDocTypes())
    } catch {
      // A failed load must not masquerade as "no document types" — that would hide
      // an outage behind an empty list.
      setError(true)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const v = value.trim()
    if (!v || busy) return
    setBusy(true)
    try {
      await addDocumentType(v, flow)
      toast.ok(t('adminOptions.docTypes.added'))
      setValue('')
      await load()
    } catch (err) {
      toast.err((err as { message?: string })?.message ?? t('adminOptions.docTypes.addErr'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(d: AdminDocType) {
    try {
      await setDocTypeActive(d.id, !d.active)
      toast.ok(t(d.active ? 'adminOptions.docTypes.hiddenToast' : 'adminOptions.docTypes.shownToast', { value: d.value }))
      await load()
    } catch {
      toast.err(t('adminOptions.docTypes.actionErr'))
    }
  }

  async function doDelete(d: AdminDocType) {
    try {
      await deleteDocType(d.id)
      toast.ok(t('adminOptions.docTypes.deletedToast', { value: d.value }))
      await load()
    } catch {
      toast.err(t('adminOptions.docTypes.actionErr'))
    }
  }

  const hasHidden = groups?.some((g) => g.types.some((d) => !d.active)) ?? false

  return (
    <section className="doctypes card" aria-label={t('adminOptions.docTypes.title')}>
      <div className="dt-head">
        <p className="dt-hint">{t('adminOptions.docTypes.hint')}</p>
        {hasHidden && (
          <label className="dt-showhidden">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            {t('adminOptions.docTypes.showHidden')}
          </label>
        )}
      </div>

      {error ? (
        <StateNotice kind="error" text={t('adminOptions.loadError')} onRetry={load} />
      ) : !groups ? (
        <StateNotice kind="loading" text={t('adminOptions.loading')} />
      ) : groups.length === 0 ? (
        <p className="dt-empty">{t('adminOptions.docTypes.empty')}</p>
      ) : null}

      {groups?.map((g) => {
        const visible = g.types.filter((d) => showHidden || d.active)
        if (visible.length === 0) return null
        return (
          <div key={g.flow} className="dt-group">
            <span className="dt-flow" lang="en">
              {g.flow}
            </span>
            <span className="dt-vals">
              {visible.map((d) => (
                <span key={d.id} className={d.active ? 'dt-chip' : 'dt-chip off'}>
                  <span className="dt-val" lang="en">
                    {d.value}
                  </span>
                  <span className="dt-count">·{d.usedBy}</span>
                  {!d.active && <span className="dt-off-pill">{t('adminOptions.docTypes.hiddenChip')}</span>}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className="dt-menu-btn"
                        aria-label={t('adminOptions.docTypes.menuAria', { value: d.value })}
                      >
                        <MoreHorizontal size={14} aria-hidden />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content className="dt-menu" align="end" sideOffset={4}>
                        <DropdownMenu.Item className="dt-mi" onSelect={() => void toggleActive(d)}>
                          {d.active ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
                          {t(d.active ? 'adminOptions.docTypes.hide' : 'adminOptions.docTypes.unhide')}
                        </DropdownMenu.Item>
                        {d.usedBy === 0 ? (
                          <DropdownMenu.Item className="dt-mi danger" onSelect={() => setConfirmDelete(d)}>
                            <Trash2 size={14} aria-hidden />
                            {t('adminOptions.docTypes.delete')}
                          </DropdownMenu.Item>
                        ) : (
                          <div className="dt-mi-note">{t('adminOptions.docTypes.deleteBlocked', { n: d.usedBy })}</div>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </span>
              ))}
            </span>
          </div>
        )
      })}

      <form className="dt-add" onSubmit={add}>
        <input
          className="txt-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('adminOptions.docTypes.namePlaceholder')}
          maxLength={60}
          aria-label={t('adminOptions.docTypes.namePlaceholder')}
        />
        <Select
          value={flow}
          onChange={setFlow}
          options={FLOWS.map((f) => ({ value: f, label: f }))}
          ariaLabel={t('adminOptions.docTypes.flowLabel')}
        />
        <button type="submit" className="btn primary" disabled={busy || !value.trim()}>
          <Plus size={16} aria-hidden />
          {t('adminOptions.docTypes.addBtn')}
        </button>
      </form>

      {confirmDelete && (
        <ConfirmModal
          title={t('adminOptions.docTypes.confirmDeleteTitle')}
          message={t('adminOptions.docTypes.confirmDeleteMessage')}
          code={confirmDelete.value}
          danger
          confirmLabel={t('adminOptions.docTypes.confirmDeleteLabel')}
          onConfirm={async () => {
            const d = confirmDelete
            setConfirmDelete(null)
            await doDelete(d)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </section>
  )
}
