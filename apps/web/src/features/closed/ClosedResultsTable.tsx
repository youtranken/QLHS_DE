import { fmtDate, t } from '../../i18n'
import type { TicketView } from '../tickets/api'
import { statusVi } from '../tickets/statusLabel'
import { groupAmount } from '../../shared/format'
import { openTicketDetail } from '../../shared/route'

const FLOW_CHIP: Record<string, string> = {
  Contract: 'fl-contract',
  Payment: 'fl-payment',
  General: 'fl-general',
}

export interface ClosedResultsTableProps {
  rows: TicketView[]
  role?: string | null
  onReopen: (id: string) => void
  onPropose: (id: string) => void
}

/** Read-only results grid for FR-17 lookup; responsive (th scope + data-label →
 *  card layout ≤680px). Row actions depend on the viewer's DCC role. */
export function ClosedResultsTable({ rows, role, onReopen, onPropose }: ClosedResultsTableProps) {
  return (
    <div className="tblwrap">
      <table className="tbl closedtbl">
        <thead>
          <tr>
            <th scope="col">{t('closed.thCode')}</th>
            <th scope="col">{t('closed.thFlow')}</th>
            <th scope="col">{t('closed.thContractor')}</th>
            <th scope="col" className="num">
              {t('closed.thAmount')}
            </th>
            <th scope="col">{t('closed.thContractNo')}</th>
            <th scope="col">{t('closed.thCreated')}</th>
            <th scope="col">{t('closed.thStatus')}</th>
            <th scope="col">{t('closed.thActions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tk) => (
            <tr key={tk.id}>
              <td data-label={t('closed.thCode')}>
                <button type="button" className="code" onClick={() => openTicketDetail(tk.id)}>
                  {tk.code ?? tk.id.slice(0, 8)}
                </button>
              </td>
              <td data-label={t('closed.thFlow')}>
                <span className={`chip ${FLOW_CHIP[tk.flow] ?? ''}`}>
                  <span className="dot" />
                  <span lang="en">{tk.flow}</span>
                </span>
              </td>
              <td data-label={t('closed.thContractor')}>{tk.contractor ?? <span className="nul">—</span>}</td>
              <td className="num" data-label={t('closed.thAmount')}>
                {tk.amount ? (
                  <>
                    {groupAmount(tk.amount, tk.currency ?? 'VND')} <span className="u">{tk.currency}</span>
                  </>
                ) : (
                  <span className="nul">—</span>
                )}
              </td>
              <td className="mono" data-label={t('closed.thContractNo')}>
                {tk.contractNo ?? <span className="nul">—</span>}
              </td>
              <td className="mono" data-label={t('closed.thCreated')} style={{ color: 'var(--ink-3)' }}>
                {fmtDate(tk.createdAt)}
              </td>
              <td data-label={t('closed.thStatus')}>
                <span className={`chip${tk.status === 'Cancelled' ? '' : ' done'}`}>
                  <span className="dot" aria-hidden />
                  <span lang="en">{tk.status}</span>
                </span>
                <span className="vi">{statusVi(tk.status)}</span>
              </td>
              <td className="act" data-label={t('closed.thActions')}>
                {role === 'DCC1' && (
                  <button
                    type="button"
                    className="btn warn"
                    title={t('closed.reopenBtnTitle')}
                    onClick={() => onReopen(tk.id)}
                  >
                    {t('closed.reopenBtn')}
                  </button>
                )}
                {(role === 'DCC2' || role === 'DCC3') && (
                  <button type="button" className="btn ghost" onClick={() => onPropose(tk.id)}>
                    {t('closed.proposeBtn')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
