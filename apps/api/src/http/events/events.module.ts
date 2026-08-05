import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { EventsController } from './events.controller'
import { TicketNotifyListener } from '../../infra/events/ticket-notify.listener'

/** 2.1 — SSE fan-out of ticket changes. AuthModule provides the cookie AuthGuard. */
@Module({
  imports: [AuthModule],
  controllers: [EventsController],
  providers: [TicketNotifyListener],
})
export class EventsModule {}
