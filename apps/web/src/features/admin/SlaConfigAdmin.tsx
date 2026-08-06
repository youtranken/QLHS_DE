import { useCallback, useEffect, useMemo, useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { Minus, Plus } from 'lucide-react'
import { applyVp, t } from '../../i18n'
import { StateNotice } from '../../shared/StateNotice'
import { toast } from '../../shared/toast'
import { getSlaConfig, updateSla, type SlaConfigRow } from './api'

/** Thứ tự luồng: Chung trước, rồi General → Contract-Budget → Payment. */
const FLOW_ORDER = ['*', 'General', 'Contract', 'Payment']
/** Tab mở sẵn — tuyến dài nhất, nơi có nhiều ga nhất để chỉnh. */
const DEFAULT_FLOW = 'Contract'

type FlowView = {
  /** class màu luồng (metro + tab): shared=accent · a=teal · b=blue · c=violet */
  data: 'shared' | 'a' | 'b' | 'c'
  label: string
  en: boolean
  desc: string
  shared: boolean
}

/** Nhãn/mô tả/màu cho một luồng. Hàm (không const) để t() đọc lại catalog mỗi
 *  render — sẵn cho đổi ngôn ngữ. `*` = ngưỡng chung áp mọi luồng. */
function flowView(flow: string): FlowView {
  switch (flow) {
    case '*':
      return { data: 'shared', label: t('adminSla.tabs.all'), en: false, desc: t('adminSla.flowDesc.all'), shared: true }
    case 'General':
      return { data: 'a', label: 'General', en: true, desc: t('adminSla.flowDesc.general'), shared: false }
    case 'Contract':
      return { data: 'b', label: 'Contract-Budget', en: true, desc: t('adminSla.flowDesc.contract'), shared: false }
    case 'Payment':
      return { data: 'c', label: 'Payment', en: true, desc: t('adminSla.flowDesc.payment'), shared: false }
    default:
      return { data: 'shared', label: flow, en: false, desc: '', shared: true }
  }
}

/** Phụ đề VI từng ga (catalog `adminSla.statusNote`, Record mở — t() trả lại
 *  nguyên key khi thiếu, nên so lại để giữ hành vi "không note thì ẩn"). */
function statusNote(status: string): string | undefined {
  const key = `adminSla.statusNote.${status}` as const
  const s = t(key)
  return s === key ? undefined : s
}

const keyOf = (r: SlaConfigRow) => `${r.flow}|${r.status}`
const clamp = (n: number) => Math.min(30, Math.max(1, n))

/** SA console (Story 5.1): chỉnh ngưỡng SLA theo (luồng × trạng thái). Mỗi luồng
 *  một tab; panel là metro có thứ tự (Ga 1,2,3…) với stepper từng ga; sửa nhiều
 *  luồng rồi lưu một lần qua thanh lưu dưới cùng (dirty đếm trên MỌI luồng).
 *  Ngưỡng ≥ 1 ngày làm việc (giữ ràng buộc domain). Lưu là áp ngay badge ▲. */
export function SlaConfigAdmin() {
  const [rows, setRows] = useState<SlaConfigRow[]>([])
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      setRows(await getSlaConfig())
      setEdits({})
      setLoaded(true)
    } catch {
      setError(true)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const valOf = useCallback((r: SlaConfigRow) => edits[keyOf(r)] ?? r.slaDays, [edits])
  const dirty = useMemo(
    // Exclude a transient blank field (NaN) — it is neither pending nor savable
    // until committed on blur.
    () =>
      rows.filter((r) => {
        const e = edits[keyOf(r)]
        return e !== undefined && !Number.isNaN(e) && e !== r.slaDays
      }),
    [rows, edits],
  )

  const groups = useMemo(() => {
    const by = new Map<string, SlaConfigRow[]>()
    for (const r of rows) {
      const g = by.get(r.flow) ?? []
      g.push(r)
      by.set(r.flow, g)
    }
    return [...by.entries()].sort(
      (a, b) => (FLOW_ORDER.indexOf(a[0]) + 99) - (FLOW_ORDER.indexOf(b[0]) + 99),
    )
  }, [rows])

  const defaultFlow = groups.some(([f]) => f === DEFAULT_FLOW) ? DEFAULT_FLOW : groups[0]?.[0]

  // An empty string is a transient blank so the field can be cleared and retyped;
  // it holds NaN until blur (commitVal), then snaps back to the saved value.
  // The ± buttons always pass a number.
  function setVal(r: SlaConfigRow, raw: number | string) {
    const n = typeof raw === 'string' ? (raw.trim() === '' ? NaN : parseInt(raw, 10)) : raw
    setEdits((e) => ({ ...e, [keyOf(r)]: Number.isNaN(n) ? NaN : clamp(n) }))
  }
  function commitVal(r: SlaConfigRow) {
    if (Number.isNaN(valOf(r))) setEdits((e) => ({ ...e, [keyOf(r)]: r.slaDays }))
  }

  function revertAll() {
    setEdits({})
  }

  async function saveAll() {
    const changed = dirty
    if (changed.length === 0) return
    setSaving(true)
    try {
      for (const r of changed) await updateSla(r.flow, r.status, edits[keyOf(r)]!)
      await load()
      toast.ok(t('adminSla.config.savedMsg', { n: changed.length }))
    } catch {
      // Saves are sequential and non-atomic — a mid-batch failure has already
      // persisted the earlier rows. Resync from the server so the save bar reflects
      // what actually saved instead of re-offering already-saved rows as "dirty".
      await load().catch(() => {})
      toast.err(t('adminSla.config.saveFail'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label={t('adminSla.config.title')}>
      <h1 className="sr-only">{t('adminSla.config.title')}</h1>
      <p className="sla-info">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M12 11v5" />
        </svg>
        {t('adminSla.config.infoPrefix')}<b>{t('adminSla.config.infoBold')}</b>{t('adminSla.config.infoSuffix')}
      </p>

      {error ? (
        <StateNotice kind="error" text={t('adminSla.config.loadError')} onRetry={load} />
      ) : !loaded ? (
        <StateNotice kind="loading" text={t('adminSla.config.loading')} />
      ) : !defaultFlow ? (
        <StateNotice kind="empty" text={t('adminSla.config.empty')} />
      ) : (
        <Tabs.Root className="slatabs" defaultValue={defaultFlow}>
          <Tabs.List className="flowtabs" aria-label={t('adminSla.config.tablistAria')}>
            {groups.map(([flow, rs]) => {
              const fv = flowView(flow)
              return (
                <Tabs.Trigger key={flow} value={flow} className="flowtab" data-flow={fv.data}>
                  <span lang={fv.en ? 'en' : undefined}>{fv.label}</span>
                  <span className="tab-n">{rs.length}</span>
                </Tabs.Trigger>
              )
            })}
          </Tabs.List>

          {groups.map(([flow, rs]) => {
            const fv = flowView(flow)
            return (
              <Tabs.Content
                key={flow}
                value={flow}
                forceMount
                className="flow-panel"
                aria-label={t('adminSla.config.sectionAria', { flow: fv.label })}
              >
                <div className="flow-header">
                  <span className={`flow-badge ${fv.data}`} aria-hidden>
                    {fv.shared ? '∗' : fv.label.charAt(0)}
                  </span>
                  <div className="fh-text">
                    <div className="fh-name" lang={fv.en ? 'en' : undefined}>{fv.label}</div>
                    <div className="fh-desc">{fv.desc}</div>
                  </div>
                  <span className="cnt2">{t('adminSla.config.stationCount', { n: rs.length })}</span>
                </div>

                <div className="card stations metro" data-flow={fv.data}>
                  {rs.map((r, i) => {
                    const v = valOf(r)
                    const isDirty = v !== r.slaDays
                    const note = statusNote(r.status)
                    return (
                      <div className={isDirty ? 'station is-dirty' : 'station'} key={keyOf(r)}>
                        <div className="st-node">
                          {fv.shared ? (
                            <span className="node-pill">{t('adminSla.config.stationPill')}</span>
                          ) : (
                            <span className="node-dot">{i + 1}</span>
                          )}
                        </div>
                        <div className="st-meta">
                          <div className="st-name" lang="en">{applyVp(r.status)}</div>
                          {note && <div className="st-note">{note}</div>}
                        </div>
                        <div className="st-right">
                          {isDirty && <span className="dirty-tag">{t('adminSla.config.dirty')}</span>}
                          <div className="st-ctrl">
                            <div className="stepper">
                              <button
                                type="button"
                                aria-label={t('adminSla.config.decAria', { flow: r.flow, status: r.status })}
                                onClick={() => setVal(r, (Number.isNaN(v) ? r.slaDays : v) - 1)}
                              >
                                <Minus aria-hidden />
                              </button>
                              <input
                                className="stin"
                                type="number"
                                min={1}
                                max={30}
                                step={1}
                                value={Number.isNaN(v) ? '' : v}
                                aria-label={t('adminSla.config.inputAria', { flow: r.flow, status: r.status })}
                                onChange={(e) => setVal(r, e.target.value)}
                                onBlur={() => commitVal(r)}
                              />
                              <button
                                type="button"
                                aria-label={t('adminSla.config.incAria', { flow: r.flow, status: r.status })}
                                onClick={() => setVal(r, (Number.isNaN(v) ? r.slaDays : v) + 1)}
                              >
                                <Plus aria-hidden />
                              </button>
                            </div>
                            <span className="st-unit">{t('adminSla.config.unitDay')}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {!fv.shared && (
                  <div className="metro-note">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8h.01M12 11v5" />
                    </svg>
                    <span>{t('adminSla.config.sharedNote')}</span>
                  </div>
                )}
              </Tabs.Content>
            )
          })}
        </Tabs.Root>
      )}

      {dirty.length > 0 && (
        <div className="savebar" role="region" aria-label={t('adminSla.config.savebarAria')}>
          <span className="msg">
            <b>{dirty.length}</b>{t('adminSla.config.unsavedSuffix')}
          </span>
          <button type="button" className="btn" onClick={revertAll} disabled={saving}>
            {t('adminSla.config.cancel')}
          </button>
          <button type="button" className="btn primary" onClick={() => void saveAll()} disabled={saving}>
            {saving ? t('adminSla.config.saving') : t('adminSla.config.saveBtn')}
          </button>
        </div>
      )}
    </section>
  )
}
