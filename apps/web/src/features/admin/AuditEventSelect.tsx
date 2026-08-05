import { Select, type SelectOption } from '../../shared/Select'

/** Event filter for the audit log — thin wrapper over the shared themed Select.
 *  Emits '' for "all events" so the API query param is unchanged. */
export function AuditEventSelect({
  value,
  onChange,
  events,
  allLabel,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  events: readonly string[]
  allLabel: string
  ariaLabel: string
}) {
  const options: SelectOption[] = [
    { value: '', label: allLabel },
    ...events.map((ev) => ({ value: ev, label: <span lang="en">{ev}</span> })),
  ]
  return <Select value={value} onChange={onChange} options={options} ariaLabel={ariaLabel} />
}
