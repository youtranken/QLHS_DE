import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { MetricsRepo } from '../prisma/admin/metrics.repo'
import { evaluateBacklog, type BacklogConfig, type BacklogLevel } from '../../domain/metrics/backlog'

/** Positive-int env with fallback. Guards the alert thresholds against a blank
 *  (`Number('')===0` → warn on every empty queue) or typo'd (`Number('x')===NaN` →
 *  `n>=NaN` always false → alert silently OFF) value — either would defeat 3.2. */
function posIntEnv(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return raw !== undefined && raw.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/**
 * 3.2 — hourly outbox-backlog watch. Emits ONE structured log line per run when
 * the mail/digest queue is over threshold (WARN building, ERROR when a mail was
 * actually dropped), so an external collector (Loki/journald) or a Prometheus
 * alert on `qlhs_mail_outbox` can page operations. Gated by QLHS_DISABLE_CRON so
 * tests drive check() directly. No in-app write — this is an ops signal, not a
 * ticket event (keeps the bell for people, the log for operators).
 */
@Injectable()
export class OpsHealthScheduler {
  private readonly log = new Logger('OpsHealth')
  private readonly cfg: BacklogConfig = {
    pendingWarn: posIntEnv(process.env.QLHS_MAIL_BACKLOG_WARN, 20),
    pendingCritical: posIntEnv(process.env.QLHS_MAIL_BACKLOG_CRITICAL, 100),
  }

  constructor(private readonly metrics: MetricsRepo) {}

  @Cron(CronExpression.EVERY_HOUR)
  scheduled(): Promise<BacklogLevel> {
    if (process.env.QLHS_DISABLE_CRON === '1') return Promise.resolve('ok')
    return this.check().catch((e) => {
      this.log.error(`backlog check failed: ${String(e)}`)
      return 'ok' as BacklogLevel
    })
  }

  /** Assess the queue depths; log when not ok. Returns the level for tests. */
  async check(): Promise<BacklogLevel> {
    const s = await this.metrics.collect()
    const verdict = evaluateBacklog(
      {
        mailPending: s.mailPending,
        mailFailed: s.mailFailed,
        digestPending: s.digestPending,
        digestFailed: s.digestFailed,
      },
      this.cfg,
    )
    if (verdict.level === 'ok') return 'ok'

    const line = JSON.stringify({
      event: 'outbox_backlog',
      level: verdict.level,
      breached: verdict.breached,
      mailPending: s.mailPending,
      mailFailed: s.mailFailed,
      digestPending: s.digestPending,
      digestFailed: s.digestFailed,
    })
    if (verdict.level === 'critical') this.log.error(line)
    else this.log.warn(line)
    return verdict.level
  }
}
