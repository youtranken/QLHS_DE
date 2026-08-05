import { Module } from '@nestjs/common'
import { AuthModule } from '../http/auth/auth.module'
import { TicketModule } from '../ticket.module'
import { NotificationsModule } from '../http/notifications/notifications.module'
import { AssistantController } from './assistant.controller'
import { AssistantService } from './assistant.service'
import { AssistantRateLimiter } from './rate-limiter'
import { ToolRegistry } from './tool-registry'
import { GetMyTicketsTool } from './tools/get-my-tickets.tool'
import { GetTicketDetailTool } from './tools/get-ticket-detail.tool'
import { WhatsNextTool } from './tools/whats-next.tool'
import { GetMyNotificationsTool } from './tools/get-my-notifications.tool'
import { ClosedLookupTool } from './tools/closed-lookup.tool'
import { GetMyWorkboxTool } from './tools/get-my-workbox.tool'
import { GetDispatchMapTool } from './tools/get-dispatch-map.tool'
import { GetStationTicketsTool } from './tools/get-station-tickets.tool'
import { GetPausedTicketsTool } from './tools/get-paused-tickets.tool'
import { GetOverviewTool } from './tools/get-overview.tool'
import { GetAnalyticsTool } from './tools/get-analytics.tool'
import { SearchAuditTool } from './tools/search-audit.tool'

/** Trợ lý nội bộ — một thư mục tự chứa. Tái dùng use-case đọc từ TicketModule
 *  (list/detail/closed/workbox/dispatch/station) + AuthModule (overview/analytics/
 *  audit/paused) + NotificationsModule — chỉ import, không cấp lại repo. */
@Module({
  imports: [AuthModule, TicketModule, NotificationsModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    // Tham số primitive (limit/clock) → cấp qua factory, không để Nest DI.
    { provide: AssistantRateLimiter, useFactory: () => new AssistantRateLimiter() },
    ToolRegistry,
    GetMyTicketsTool,
    GetTicketDetailTool,
    WhatsNextTool,
    GetMyNotificationsTool,
    ClosedLookupTool,
    GetMyWorkboxTool,
    GetDispatchMapTool,
    GetStationTicketsTool,
    GetPausedTicketsTool,
    GetOverviewTool,
    GetAnalyticsTool,
    SearchAuditTool,
  ],
})
export class AssistantModule {}
