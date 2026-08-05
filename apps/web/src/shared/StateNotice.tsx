import { t } from '../i18n'

/** One place for the three non-content states, so loading ≠ error ≠ empty are
 *  visually distinct (a spinner, a red retry panel, a neutral dashed box) instead
 *  of the one dashed `.console-soon` box they all used to share. */
export function StateNotice({
  kind,
  text,
  onRetry,
}: {
  kind: 'loading' | 'error' | 'empty'
  text?: string
  onRetry?: () => void
}) {
  const label = text ?? (kind === 'loading' ? t('common.states.loading') : '')
  return (
    <div className={`statebox ${kind}`} role={kind === 'error' ? 'alert' : 'status'} aria-live="polite">
      {kind === 'loading' && <span className="spin" aria-hidden />}
      <span className="sb-msg">{label}</span>
      {kind === 'error' && onRetry && (
        <button type="button" className="btn sb-retry" onClick={onRetry}>
          {t('common.states.retry')}
        </button>
      )}
    </div>
  )
}
