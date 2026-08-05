import { Module } from '@nestjs/common'
import { MetricsController } from './metrics.controller'
import { MetricsGuard } from './metrics.guard'
import { GetMetricsUseCase } from '../../application/metrics/get-metrics.usecase'
import { MetricsRepo } from '../../infra/prisma/admin/metrics.repo'
import { SlaPauseRepo } from '../../infra/prisma/sla/sla-pause.repo'
import { OpsHealthScheduler } from '../../infra/scheduler/ops-health.scheduler'

/** 3.2 — `/metrics` scrape endpoint + hourly outbox-backlog alert. PrismaService
 *  is global; everything else is self-contained here. */
@Module({
  controllers: [MetricsController],
  providers: [GetMetricsUseCase, MetricsRepo, SlaPauseRepo, MetricsGuard, OpsHealthScheduler],
})
export class MetricsModule {}
