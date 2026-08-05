import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import type { StationTicket } from './api'
import { useStationData } from './useStationData'
import { TERMINAL } from './StationNode'
import { MetroLine } from './MetroLine'
import { StationPopover } from './StationPopover'
import { StationDrawer } from './StationDrawer'
import { StateNotice } from '../../shared/StateNotice'
import { toast } from '../../shared/toast'

interface Pop {
  status: string
  anchor: DOMRect
  tickets: StationTicket[]
}

/** Bản đồ tuyến metro (SIGNATURE, chỉ đọc): một ray/luồng, node = ga; hover →
 *  popover preview, click → drawer chi tiết. Server-scoped theo vai. */
export function LineMap({ scope }: { scope?: string }) {
  const { lines, ticketsOf, loaded, error, reload } = useStationData()
  const [pop, setPop] = useState<Pop | null>(null)
  const [drawer, setDrawer] = useState<{ status: string; tickets: StationTicket[] } | null>(null)
  const hovering = useRef<string | null>(null)

  // "Đang chạy" = hồ sơ ở ga CHƯA-cuối (loại Completed/Sent) — l.total gồm cả ga
  // cuối nên không dùng ở đây; khớp overTotal + định nghĩa running của Overview.
  const running = lines.reduce(
    (n, l) => n + l.stations.reduce((m, s) => m + (TERMINAL.test(s.status) ? 0 : s.count), 0),
    0,
  )
  // Ga cuối (Completed/Sent) không tính quá-SLA — khớp quy tắc node ở StationNode.
  const overTotal = lines.reduce(
    (n, l) =>
      n +
      l.stations.reduce((m, s) => m + (s.overSla && !TERMINAL.test(s.status) ? s.overdueCount : 0), 0),
    0,
  )

  const hover = useCallback(
    async (status: string, flow: string, el: HTMLElement) => {
      hovering.current = status
      // Nút .stn co về cao 0px (mọi con absolute) → neo popover vào viên node .nd
      // để nó nằm ĐÚNG dưới node, không lệch lên trên.
      const node = (el.querySelector('.nd') as HTMLElement | null) ?? el
      const anchor = node.getBoundingClientRect()
      try {
        const tickets = await ticketsOf(status, flow)
        if (hovering.current === status) setPop({ status, anchor, tickets })
      } catch {
        // Hover preview is best-effort — a click (open) surfaces the error loudly.
      }
    },
    [ticketsOf],
  )
  const leave = useCallback(() => {
    hovering.current = null
    setPop(null)
  }, [])
  const open = useCallback(
    async (status: string, flow: string) => {
      hovering.current = null
      setPop(null)
      try {
        setDrawer({ status, tickets: await ticketsOf(status, flow) })
      } catch {
        toast.err(t('dispatch.openErr'))
      }
    },
    [ticketsOf],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section className="panel" aria-label={t('dispatch.mapTitle')}>
      <div className="panel-hd">
        <h2>{t('dispatch.mapTitle')}</h2>
        {scope && <span className="mapscope">{scope}</span>}
        {loaded && lines.length > 0 && (
          <span className="mapstats" aria-label={t('dispatch.kpisAria')}>
            <span className="mapstat">
              <b>{running}</b> {t('dispatch.kpiRunning')}
            </span>
            <span className={overTotal > 0 ? 'mapstat hot' : 'mapstat'}>
              <b>{overTotal}</b> {t('dispatch.kpiOverdue')}
            </span>
          </span>
        )}
        <div className="loadband">
          <span className="legend" aria-hidden>
            <span className="lg lg-front">
              <i />
              {t('dispatch.legendFront')}
            </span>
            <span className="lg lg-over">
              <i />
              {t('dispatch.legendOver')}
            </span>
            <span className="lg lg-done">
              <i />
              {t('dispatch.legendDone')}
            </span>
          </span>
        </div>
      </div>

      {!loaded && error ? (
        <div className="panel-bd">
          <StateNotice kind="error" text={error} onRetry={() => void reload()} />
        </div>
      ) : !loaded ? (
        <div className="panel-bd">
          <StateNotice kind="loading" text={t('dispatch.loadingText')} />
        </div>
      ) : lines.length === 0 ? (
        <div className="panel-bd">
          <StateNotice kind="empty" text={t('dispatch.emptyText')} />
        </div>
      ) : (
        <>
          <div className="metrohint" aria-hidden>
            {t('dispatch.scrollHint')}
          </div>
          <div className="metro">
            <div className="mapinner">
              {lines.map((l) => (
                <MetroLine key={l.flow} line={l} onOpen={open} onHover={hover} onLeave={leave} />
              ))}
            </div>
          </div>
        </>
      )}

      {pop && <StationPopover status={pop.status} tickets={pop.tickets} anchor={pop.anchor} />}
      {drawer && (
        <>
          <div className="stndrawer-scrim" onClick={() => setDrawer(null)} aria-hidden />
          <StationDrawer status={drawer.status} tickets={drawer.tickets} onClose={() => setDrawer(null)} />
        </>
      )}
    </section>
  )
}
