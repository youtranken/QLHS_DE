import { Injectable } from '@nestjs/common'
import { type Role } from '@qlhs/contracts'
import { type AssistantTool } from './assistant-tool'
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

@Injectable()
export class ToolRegistry {
  private readonly tools: AssistantTool[]

  constructor(
    myTickets: GetMyTicketsTool,
    detail: GetTicketDetailTool,
    next: WhatsNextTool,
    notifications: GetMyNotificationsTool,
    closed: ClosedLookupTool,
    workbox: GetMyWorkboxTool,
    dispatch: GetDispatchMapTool,
    station: GetStationTicketsTool,
    paused: GetPausedTicketsTool,
    overview: GetOverviewTool,
    analytics: GetAnalyticsTool,
    audit: SearchAuditTool,
  ) {
    this.tools = [
      myTickets, detail, next, notifications, closed, workbox,
      dispatch, station, paused, overview, analytics, audit,
    ]
  }

  /** Tool nhìn thấy được theo activeRole (role-less → không tool nào). */
  forActiveRole(role: Role | null): AssistantTool[] {
    return role ? this.tools.filter((t) => t.activeRoles.includes(role)) : []
  }

  find(name: string): AssistantTool | undefined {
    return this.tools.find((t) => t.name === name)
  }
}
