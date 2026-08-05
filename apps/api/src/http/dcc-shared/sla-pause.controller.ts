import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { IsString, MaxLength, MinLength } from 'class-validator'
import { ROLE } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { PauseSlaUseCase, ResumeSlaUseCase } from '../../application/sla/sla-pause.usecase'

export class PauseReasonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string
}

/**
 * F8 — "chờ bổ sung". No role gate beyond "a DCC": the use-case already narrows
 * it to the ticket's CURRENT HOLDER, which is stricter than any role check and
 * survives a role being reassigned mid-flight.
 */
@Controller('ticket')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3)
export class SlaPauseController {
  constructor(
    private readonly pause: PauseSlaUseCase,
    private readonly resume: ResumeSlaUseCase,
  ) {}

  @Post(':id/sla-pause')
  @HttpCode(200)
  async pauseSla(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: PauseReasonDto,
  ): Promise<{ ok: true }> {
    await this.pause.execute({ ticketId: id, actorSub: user.sub, reason: dto.reason })
    return { ok: true }
  }

  @Post(':id/sla-resume')
  @HttpCode(200)
  async resumeSla(@GetCurrentUser() user: CurrentUser, @Param('id') id: string): Promise<{ ok: true }> {
    await this.resume.execute({ ticketId: id, actorSub: user.sub })
    return { ok: true }
  }
}
