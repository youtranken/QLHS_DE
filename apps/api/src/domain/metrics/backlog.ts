// Mail/digest outbox backlog assessment (3.2). Pure: the scheduler feeds it the
// current queue depths, this decides whether operations must be alerted.

export interface BacklogCounts {
  mailPending: number
  mailFailed: number
  digestPending: number
  digestFailed: number
}

export interface BacklogConfig {
  /** `pending` at/above this is a warning — mail is queuing faster than it drains. */
  pendingWarn: number
  /** `pending` at/above this is critical — the queue is genuinely stuck. */
  pendingCritical: number
}

export type BacklogLevel = 'ok' | 'warn' | 'critical'

export interface BacklogVerdict {
  level: BacklogLevel
  breached: string[]
  message: string
}

/**
 * A `failed` row means the whole backoff window was spent and a notification was
 * dropped — always critical, independent of any threshold. Pending depth is a
 * softer signal: warn as it builds, critical once it is clearly stuck.
 */
export function evaluateBacklog(counts: BacklogCounts, cfg: BacklogConfig): BacklogVerdict {
  const breached: string[] = []
  let level: BacklogLevel = 'ok'
  const raise = (to: BacklogLevel) => {
    if (to === 'critical' || (to === 'warn' && level === 'ok')) level = to
  }

  if (counts.mailFailed > 0) { breached.push('mailFailed'); raise('critical') }
  if (counts.digestFailed > 0) { breached.push('digestFailed'); raise('critical') }

  for (const key of ['mailPending', 'digestPending'] as const) {
    const n = counts[key]
    if (n >= cfg.pendingCritical) { breached.push(key); raise('critical') }
    else if (n >= cfg.pendingWarn) { breached.push(key); raise('warn') }
  }

  const message =
    level === 'ok'
      ? 'outbox healthy'
      : `outbox backlog: ${breached.map((k) => `${k}=${counts[k as keyof BacklogCounts]}`).join(', ')}`
  return { level, breached, message }
}
