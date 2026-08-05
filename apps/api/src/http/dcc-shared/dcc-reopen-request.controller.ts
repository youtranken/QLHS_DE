import { Controller, Param, Post, UseGuards } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { RequestReopenUseCase } from '../../application/closed/request-reopen.usecase'

/** DCC2/DCC3 may only REQUEST a reopen (FR-17) — DCC1 is the single actor that
 *  actually reopens. This records a `reopen_requested` note (B6), no status change. */
@Controller('dcc')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Dcc2, ROLE.Dcc3)
export class DccReopenRequestController {
  constructor(private readonly requestReopen: RequestReopenUseCase) {}

  @Post('tickets/:id/request-reopen')
  async request(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.requestReopen.execute({ ticketId: id, actorSub: user.sub, role: user.activeRole })
    return { ok: true }
  }
}
