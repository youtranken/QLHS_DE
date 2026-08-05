import { Injectable } from '@nestjs/common'
import { MetricsRepo } from '../../infra/prisma/admin/metrics.repo'
import { SlaPauseRepo } from '../../infra/prisma/sla/sla-pause.repo'
import { renderPrometheus, type MetricFamily } from '../../domain/metrics/prometheus'

/** Serves the Prometheus scrape body. Composes the cheap DB snapshot with process
 *  uptime; the pure renderer turns it into the text exposition format. */
@Injectable()
export class GetMetricsUseCase {
  constructor(
    private readonly repo: MetricsRepo,
    private readonly pauses: SlaPauseRepo,
  ) {}

  async render(): Promise<string> {
    const [snap, pausesOpen] = await Promise.all([this.repo.collect(), this.pauses.countOpen()])

    const families: MetricFamily[] = [
      {
        name: 'qlhs_up',
        help: 'API process is serving',
        type: 'gauge',
        samples: [{ value: 1 }],
      },
      {
        name: 'qlhs_process_uptime_seconds',
        help: 'Seconds since the API process started',
        type: 'gauge',
        samples: [{ value: Math.round(process.uptime()) }],
      },
      {
        name: 'qlhs_tickets',
        help: 'Tickets by flow and status (raw count, not SLA-derived)',
        type: 'gauge',
        samples: snap.tickets.map((t) => ({
          labels: { flow: t.flow, status: t.status },
          value: t.count,
        })),
      },
      {
        name: 'qlhs_sla_pauses_open',
        help: 'SLA clocks stopped right now (F8)',
        type: 'gauge',
        samples: [{ value: pausesOpen }],
      },
      {
        name: 'qlhs_mail_outbox',
        help: 'Notification outbox rows by status',
        type: 'gauge',
        samples: [
          { labels: { status: 'pending' }, value: snap.mailPending },
          { labels: { status: 'failed' }, value: snap.mailFailed },
        ],
      },
      {
        name: 'qlhs_digest_outbox',
        help: 'Morning-digest outbox rows by status',
        type: 'gauge',
        samples: [
          { labels: { status: 'pending' }, value: snap.digestPending },
          { labels: { status: 'failed' }, value: snap.digestFailed },
        ],
      },
    ]
    return renderPrometheus(families)
  }
}
