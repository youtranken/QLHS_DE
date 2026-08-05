import { Controller, Get, Header, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { GetMetricsUseCase } from '../../application/metrics/get-metrics.usecase'
import { MetricsGuard } from './metrics.guard'

/** Prometheus scrape target (3.2). Unauthenticated by default (trusted network),
 *  token-gated when QLHS_METRICS_TOKEN is set; exempt from the throttler so a 15s
 *  scrape never eats a real user's rate budget. */
@Controller('metrics')
@UseGuards(MetricsGuard)
@SkipThrottle()
export class MetricsController {
  constructor(private readonly metrics: GetMetricsUseCase) {}

  @Get()
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  scrape(): Promise<string> {
    return this.metrics.render()
  }
}
