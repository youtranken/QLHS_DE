import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { TicketDetailUseCase, type TicketDetail } from '../../application/core/ticket-detail.usecase'

/** Ticket detail (fields + code + status + derived SLA + actionbar + timeline).
 *  A concrete role is required (H4); Applicant sees own, DCC sees its scope,
 *  Admin sees all (oversight, read-only — the usecase grants no actions to Admin);
 *  a role-less session must never fall through to a full read. */
@Controller('ticket')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Applicant, ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3, ROLE.Admin)
export class TicketDetailController {
  constructor(private readonly detail: TicketDetailUseCase) {}

  @Get(':id')
  get(@GetCurrentUser() user: CurrentUser, @Param('id') id: string): Promise<TicketDetail> {
    return this.detail.execute(id, { role: user.activeRole, sub: user.sub })
  }
}
