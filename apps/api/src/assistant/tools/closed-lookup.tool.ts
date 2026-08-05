import { Injectable } from '@nestjs/common'
import { type Role } from '@qlhs/contracts'
import { SearchClosedTicketsUseCase } from '../../application/closed/search-closed-tickets.usecase'
import { TOOL, TOOL_ROLES } from '../intent/types'
import { type AssistantTool, type Caller } from '../assistant-tool'

/** Tra cứu hồ sơ đã đóng — scope theo `roleFlows(activeRole)` (Applicant không
 *  thấy tool này; hồ sơ đóng của Applicant nằm trong get_my_tickets). */
@Injectable()
export class ClosedLookupTool implements AssistantTool {
  readonly name = TOOL.ClosedLookup
  readonly activeRoles: readonly Role[] = TOOL_ROLES[TOOL.ClosedLookup]
  constructor(private readonly uc: SearchClosedTicketsUseCase) {}

  async run(_args: Record<string, unknown>, caller: Caller): Promise<unknown> {
    // The assistant only needs the first page of recent matches, not the pager.
    const page = await this.uc.execute(caller.activeRole, {})
    return page.items
  }
}
