import { useEffect, useId, useRef, useState } from 'react'
import { DOCUMENT_TYPE_GROUPS } from '@qlhs/contracts'
import { groupAmount } from '../../shared/format'
import { getDocumentTypes, getOptions, type CreateTicketBody, type DocTypeGroup } from './api'
import { Select, type SelectOption } from '../../shared/Select'
import { toast } from '../../shared/toast'
import { t } from '../../i18n'

// Currency codes (not translatable) — used until the admin `currency` catalog
// loads, so a fresh install still shows a usable list.
const CURRENCY_FALLBACK = ['VND', 'USD', 'EURO', 'N/A']

/**
 * The 9 applicant document fields, shared by the create form, the return-fix form
 * and the pool-edit form so labels + admin-managed dropdowns stay identical
 * everywhere. Priority and modal chrome live in the parent. `idPrefix` keeps the
 * label↔input `id`s unique when two instances mount (e.g. detail modal + list).
 */
export function TicketFieldsFieldset({
  form,
  set,
}: {
  form: CreateTicketBody
  set: (k: keyof CreateTicketBody, v: string) => void
}) {
  const [payTerms, setPayTerms] = useState<string[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [currencies, setCurrencies] = useState<string[]>([])
  const [docGroups, setDocGroups] = useState<DocTypeGroup[]>([])
  const currencyOpts = currencies.length > 0 ? currencies : CURRENCY_FALLBACK
  // Unique per instance so two mounted fieldsets (e.g. expanded row + detail modal)
  // never share label↔input ids.
  const uid = useId()
  const id = (k: string) => `${uid}-${k}`

  // Load the admin-managed dropdowns (N3); fall back to free-text when a list is
  // empty so a fresh install still works. One toast if any list fails to load.
  useEffect(() => {
    let alive = true
    let failed = false
    const pick = (kind: string, setter: (v: string[]) => void) =>
      getOptions(kind)
        .then((v) => alive && setter(v))
        .catch(() => {
          failed = true
          if (alive) setter([])
        })
    // Document type do admin quản lý (Danh mục) — fetch riêng; rỗng/lỗi thì fallback
    // hằng số DOCUMENT_TYPE_GROUPS ở docOptions bên dưới.
    void getDocumentTypes()
      .then((g) => alive && setDocGroups(g))
      .catch(() => {})
    void Promise.allSettled([
      pick('paymentTerm', setPayTerms),
      pick('projectTeam', setTeams),
      pick('currency', setCurrencies),
    ]).then(() => {
      if (alive && failed) toast.err(t('tickets.createForm.optionsErr'))
    })
    return () => {
      alive = false
    }
  }, [])

  // Keep an already-saved value selectable even if it isn't in the current catalog
  // (admin removed it / older free-text) — else the required <select> forces "" and
  // blocks save/resubmit on data that was valid.
  const withCurrent = (list: string[], value: string) =>
    value && !list.includes(value) ? [value, ...list] : list
  const opts = (list: string[], value: string): SelectOption[] =>
    withCurrent(list, value).map((x) => ({ value: x, label: x }))
  // Document Type keeps its flow grouping via non-selectable header rows; types are
  // indented under their flow header so the grouping reads at a glance. Nguồn: catalog
  // (admin) nếu có, không thì hằng số 6 loại built-in.
  const docSource: DocTypeGroup[] =
    docGroups.length > 0
      ? docGroups
      : DOCUMENT_TYPE_GROUPS.map((g) => ({ flow: g.flow, types: [...g.types] }))
  const docOptions: SelectOption[] = docSource.flatMap((g) => [
    { value: `__h-${g.flow}`, label: g.flow, header: true },
    ...g.types.map((d) => ({ value: d, label: d, indent: true })),
  ])

  // Contract flow: the real Contract No is assigned by DCC2 at send-to-Accounting,
  // so the Applicant must NOT fill it — lock the field to "N/A" (backend requires
  // non-empty). Payment/General keep it editable + required.
  const selectedFlow = docSource.find((g) => g.types.includes(form.documentType))?.flow
  const contractLocked = selectedFlow === 'Contract'
  const wasLocked = useRef(contractLocked)
  useEffect(() => {
    if (contractLocked) {
      if (form.contractNo !== 'N/A') set('contractNo', 'N/A')
    } else if (wasLocked.current) {
      set('contractNo', '') // leaving Contract → clear the auto N/A for fresh entry
    }
    wasLocked.current = contractLocked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractLocked])

  return (
    <>
      <div className="field full">
        <label htmlFor={id('description')} lang="en">
          Subject <span className="req">*</span>
        </label>
        <textarea id={id('description')} required value={form.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div className="field">
        <label lang="en">
          Document Type <span className="req">*</span>
        </label>
        <Select
          value={form.documentType}
          onChange={(v) => set('documentType', v)}
          options={docOptions}
          ariaLabel="Document Type"
        />
      </div>
      <div className="field">
        <label htmlFor={id('contractor')} lang="en">
          Contractor/Designer/Supplier (If not-Pls, write N/A) <span className="req">*</span>
        </label>
        <input id={id('contractor')} required aria-required value={form.contractor} onChange={(e) => set('contractor', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={id('contractNo')} lang="en">
          Contract No.{contractLocked ? '' : ' (If not-Pls, write N/A)'}{' '}
          {!contractLocked && <span className="req">*</span>}
        </label>
        <input
          id={id('contractNo')}
          className="mono"
          required={!contractLocked}
          disabled={contractLocked}
          value={contractLocked ? 'N/A' : form.contractNo}
          onChange={(e) => set('contractNo', e.target.value)}
        />
        {contractLocked && (
          <span className="hint">DCC2 sẽ gán số hợp đồng khi gửi Kế toán — bạn không cần nhập.</span>
        )}
      </div>
      <div className="field">
        <label htmlFor={id('projectTeam')} lang="en">
          Project/Team <span className="req">*</span>
        </label>
        {teams.length > 0 ? (
          <Select
            value={form.projectTeam}
            onChange={(v) => set('projectTeam', v)}
            options={opts(teams, form.projectTeam)}
            placeholder={t('tickets.createForm.selectPlaceholder')}
            ariaLabel="Project/Team"
          />
        ) : (
          <input id={id('projectTeam')} required value={form.projectTeam} onChange={(e) => set('projectTeam', e.target.value)} />
        )}
      </div>
      <div className="field">
        <label htmlFor={id('amount')} lang="en">
          Amount (100,000) $ (If not-Pls, write 0) <span className="req">*</span>
        </label>
        <div className="amtrow">
          {/* Group by the chosen currency so the typed value matches the list/detail. */}
          <input
            id={id('amount')}
            className="mono"
            required
            inputMode="numeric"
            value={groupAmount(form.amount, form.currency)}
            onChange={(e) => set('amount', e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      <div className="field">
        <label lang="en">
          Currency (If not-Pls, choose N/A)<span className="req">*</span>
        </label>
        <Select
          value={form.currency}
          onChange={(v) => set('currency', v)}
          options={opts(currencyOpts, form.currency)}
          ariaLabel="Currency"
        />
      </div>
      <div className="field">
        <label htmlFor={id('paymentTerm')} lang="en">
          Payment Term (If not-Pls, choose N/A)<span className="req">*</span>
        </label>
        {payTerms.length > 0 ? (
          <Select
            value={form.paymentTerm}
            onChange={(v) => set('paymentTerm', v)}
            options={opts(payTerms, form.paymentTerm)}
            placeholder={t('tickets.createForm.selectPlaceholder')}
            ariaLabel="Payment Term"
          />
        ) : (
          <input id={id('paymentTerm')} required value={form.paymentTerm} onChange={(e) => set('paymentTerm', e.target.value)} />
        )}
      </div>
      <div className="field">
        <label htmlFor={id('budgetCode')} lang="en">
          Budget code &amp; Plan code (If not-Pls, write N/A) <span className="req">*</span>
        </label>
        <input id={id('budgetCode')} className="mono" required value={form.budgetCode} onChange={(e) => set('budgetCode', e.target.value)} />
      </div>
    </>
  )
}
