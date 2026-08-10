import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { FLOW } from '@qlhs/contracts'
import { getDocumentTypes, type DocTypeGroup } from '../tickets/api'
import { addDocumentType } from './api'
import { StateNotice } from '../../shared/StateNotice'
import { Select } from '../../shared/Select'
import { toast } from '../../shared/toast'
import { t } from '../../i18n'

const FLOWS: readonly string[] = Object.values(FLOW)

/** Danh mục › Document Type: liệt kê loại theo luồng + THÊM mới (kèm luồng). Không
 *  sửa/xoá — hồ sơ cũ lưu text nên đổi/gỡ sẽ nguy hiểm; chỉ cho thêm. */
export function AdminDocTypes() {
  const [groups, setGroups] = useState<DocTypeGroup[] | null>(null)
  const [error, setError] = useState(false)
  const [value, setValue] = useState('')
  const [flow, setFlow] = useState<string>(FLOWS[0] ?? 'General')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      setGroups(await getDocumentTypes())
    } catch {
      // A failed load must not masquerade as "no document types" — that would hide
      // an outage behind an empty list on an add-only catalog.
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

  return (
    <section className="doctypes card" aria-label={t('adminOptions.docTypes.title')}>
      <h2>{t('adminOptions.docTypes.title')}</h2>
      <p className="dt-hint">{t('adminOptions.docTypes.hint')}</p>

      {error ? (
        <StateNotice kind="error" text={t('adminOptions.loadError')} onRetry={load} />
      ) : !groups ? (
        <StateNotice kind="loading" text={t('adminOptions.loading')} />
      ) : groups.length === 0 ? (
        <p className="dt-empty">{t('adminOptions.docTypes.empty')}</p>
      ) : null}

      {groups?.map((g) => (
        <div key={g.flow} className="dt-group">
          <span className="dt-flow" lang="en">
            {g.flow}
          </span>
          <span className="dt-vals">
            {g.types.map((d) => (
              <span key={d} className="dt-chip" lang="en">
                {d}
              </span>
            ))}
          </span>
        </div>
      ))}

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
    </section>
  )
}
