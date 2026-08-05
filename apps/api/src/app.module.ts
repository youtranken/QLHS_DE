import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { HealthController } from './http/health/health.controller'
import { throttleDisabled } from './http/common/throttle-flag'
import { PrismaModule } from './infra/prisma/prisma.module'
import { AuthModule } from './http/auth/auth.module'
import { TicketModule } from './ticket.module'
import { EventsModule } from './http/events/events.module'
import { NotificationsModule } from './http/notifications/notifications.module'
import { MetricsModule } from './http/metrics/metrics.module'
import { AssistantModule } from './assistant/assistant.module'

/**
 * Root module. Domain regions grow as stories land; ticket transitions (AD-2)
 * live in TicketModule. ScheduleModule powers the notification dispatcher +
 * Return-fixing reminder crons (Story 5.2).
 *
 * ThrottlerModule is a per-IP DoS backstop; the tight brute-force limit lives on
 * `POST /auth/local-login` itself. `skipIf` disables it only under the test env
 * (via `throttleDisabled`, inert in production) so a burst of supertest calls
 * from one loopback IP cannot make suites flaky — the limiter is exercised by its
 * own dedicated e2e instead.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 300 }],
      skipIf: () => throttleDisabled(),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TicketModule,
    EventsModule,
    NotificationsModule,
    MetricsModule,
    AssistantModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
