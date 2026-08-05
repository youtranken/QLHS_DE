import { t, statusVi, kindMessage, applyVp } from '../../i18n'
import { type Block, type TicketRowVM } from './api'

const FLOW_VN: Record<string, string> = { General: 'Tổng hợp', Contract: 'Hợp đồng', Payment: 'Thanh toán' }
const FLOW_CLS: Record<string, string> = { General: 'general', Contract: 'contract', Payment: 'payment' }

function Code({ code, onOpen }: { code: string | null; onOpen: (c: string) => void }) {
  if (!code) return <span className="asst-code muted">—</span>
  return (
    <button type="button" className="asst-code" onClick={() => onOpen(code)}>
      {code}
    </button>
  )
}

function Flow({ flow }: { flow: string }) {
  return <span className={`asst-flow ${FLOW_CLS[flow] ?? ''}`}>{FLOW_VN[flow] ?? flow}</span>
}

/** Pill SLA cho một dòng danh sách: chỉ hiện khi có dữ liệu (không bịa "trong hạn"). */
function rowPill(r: TicketRowVM) {
  if (typeof r.overdueDays === 'number' && r.overdueDays > 0) {
    return <span className="asst-pill late">{t('assistant.card.late', { n: r.overdueDays })}</span>
  }
  if (r.priority && r.priority !== 'normal') return <span className="asst-pill rush">{r.priority}</span>
  return null
}

/** Render MỘT block. Text/empty → bong bóng chat; còn lại → thẻ có cấu trúc. */
export function AnswerCard({ block, onOpen }: { block: Block; onOpen: (code: string) => void }) {
  switch (block.type) {
    case 'text':
    case 'empty':
      return <div className="asst-bubble">{block.text}</div>

    case 'ticketList':
      return (
        <div className="asst-card">
          <div className="asst-tablewrap">
          <table>
            <thead>
              <tr>
                <th>{t('assistant.card.thCode')}</th>
                <th>{t('assistant.card.thFlow')}</th>
                <th>{t('assistant.card.thStatus')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, i) => (
                <tr key={r.code ?? `row-${i}`}>
                  <td>
                    <Code code={r.code} onOpen={onOpen} />
                  </td>
                  <td>
                    <Flow flow={r.flow} />
                  </td>
                  <td>{statusVi(r.status)}</td>
                  <td className="right">{rowPill(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {block.note && <div className="asst-note">{block.note}</div>}
        </div>
      )

    case 'ticketDetail': {
      // Hồ sơ đóng KHÔNG có SLA → không khẳng định "trong hạn" (grounding, review P2).
      const sla = block.isClosed ? (
        <span className="asst-pill neutral">{t('assistant.card.closed')}</span>
      ) : block.paused ? (
        <span className="asst-pill paused">{t('assistant.card.paused')}</span>
      ) : block.overdueDays > 0 ? (
        <span className="asst-pill late">{t('assistant.card.late', { n: block.overdueDays })}</span>
      ) : (
        <span className="asst-pill ok">{t('assistant.card.onTime')}</span>
      )
      return (
        <div className="asst-detail">
          <div className="asst-detail-hd">
            <Code code={block.code} onOpen={onOpen} />
            <Flow flow={block.flow} />
            {sla}
          </div>
          <dl>
            <dt>{t('assistant.card.thStatus')}</dt>
            <dd>{statusVi(block.status)}</dd>
            {block.documentType && (
              <>
                <dt>{t('assistant.card.thType')}</dt>
                <dd>{block.documentType}</dd>
              </>
            )}
          </dl>
        </div>
      )
    }

    case 'actions':
      return (
        <div className="asst-actions">
          <p>
            {t('assistant.card.nextStep')} <Code code={block.code} onOpen={onOpen} />:
          </p>
          <ul>
            {block.actions.map((a) => (
              <li key={a.label}>
                {a.label} <span className="arrow">→ {applyVp(a.toStatus)}</span>
              </li>
            ))}
          </ul>
        </div>
      )

    case 'notifications':
      return (
        <ul className="asst-notifs">
          {block.items.map((n, i) => (
            <li key={i} className={n.read ? undefined : 'unread'}>
              <span className="k">{kindMessage(n.kind)}</span>
              {n.code && <span className="c">{n.code}</span>}
            </li>
          ))}
        </ul>
      )

    case 'stats':
      return (
        <div className="asst-stats">
          {block.title && <p className="asst-stats-hd">{block.title}</p>}
          <div className="asst-grid">
            {block.items.map((s) => (
              <div key={s.label} className="asst-stat">
                <div className="k">{s.label}</div>
                <div className="v">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )

    case 'lines':
      return (
        <div className="asst-lines">
          {block.title && <p className="asst-lines-hd">{block.title}</p>}
          {block.items.map((ln, i) => (
            <div key={i} className="asst-line">
              <span className="p">
                {ln.code && <Code code={ln.code} onOpen={onOpen} />} {ln.primary}
              </span>
              {ln.secondary && <span className="s">{ln.secondary}</span>}
            </div>
          ))}
        </div>
      )

    default:
      return null
  }
}
