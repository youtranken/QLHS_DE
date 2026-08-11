import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { ConfirmReceivedByDcc2UseCase } from '../../application/handover/confirm-received-dcc2.usecase'
import { ReportMissingPaperUseCase } from '../../application/handover/report-missing-paper.usecase'
import { SubmitToAccountingUseCase } from '../../application/accounting/submit-to-accounting.usecase'
import { CompleteContractUseCase } from '../../application/accounting/complete-contract.usecase'
import { Dcc2ReceiveDto, SendAccountingDto } from '../dcc-shared/dcc2-receive.dto'
import { ReasonDto } from '../dcc-shared/ticket-action.dto'

/** DCC2 hardcopy handover actions (Story 3.1, AD-10): confirm receipt (phase 2)
 *  and the "missing paper" reconcile bounce. Contract flow only. */
@Controller('dcc2')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Dcc2)
export class Dcc2Controller {
  constructor(
    private readonly confirmReceived: ConfirmReceivedByDcc2UseCase,
    private readonly reportMissing: ReportMissingPaperUseCase,
    private readonly submitAccounting: SubmitToAccountingUseCase,
    private readonly completeContract: CompleteContractUseCase,
  ) {}

  @Post('tickets/:id/receive')
  async receive(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: Dcc2ReceiveDto,
  ): Promise<{ status: string }> {
    const t = await this.confirmReceived.execute({
      ticketId: id,
      actorSub: user.sub,
      receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
    })
    return { status: t.status }
  }

  @Post('tickets/:id/missing-paper')
  async missingPaper(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ): Promise<{ ok: true }> {
    await this.reportMissing.execute({ ticketId: id, actorSub: user.sub, reason: dto.reason })
    return { ok: true }
  }

  @Post('tickets/:id/send-accounting')
  sendAccounting(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: SendAccountingDto,
  ): Promise<{ status: string }> {
    return this.submitAccounting.execute({
      ticketId: id,
      actorSub: user.sub,
      documentNo: dto.documentNo,
    })
  }

  @Post('tickets/:id/complete')
  complete(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ status: string }> {
    return this.completeContract.execute({ ticketId: id, actorSub: user.sub })
  }
}
