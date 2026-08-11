import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { ConfirmReceivedByDcc3UseCase } from '../../application/handover/confirm-received-dcc3.usecase'
import { ReportMissingPaperDcc3UseCase } from '../../application/handover/report-missing-paper-dcc3.usecase'
import { SendAccountingDcc3UseCase } from '../../application/accounting/send-accounting-dcc3.usecase'
import { ReasonDto, ReceiveDateDto } from '../dcc-shared/ticket-action.dto'
import { SendAccountingDto } from '../dcc-shared/dcc2-receive.dto'

/** DCC3 hardcopy handover actions (Story 4.1, AD-10): confirm receipt (phase 2)
 *  and the "missing paper" reconcile bounce. Payment flow only. */
@Controller('dcc3')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Dcc3)
export class Dcc3Controller {
  constructor(
    private readonly confirmReceived: ConfirmReceivedByDcc3UseCase,
    private readonly reportMissing: ReportMissingPaperDcc3UseCase,
    private readonly sendAccounting: SendAccountingDcc3UseCase,
  ) {}

  @Post('tickets/:id/receive')
  receive(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ReceiveDateDto,
  ): Promise<{ status: string }> {
    return this.confirmReceived.execute({
      ticketId: id,
      actorSub: user.sub,
      receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
    })
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

  /** Enter the Document No and send to ACC → closes at `Sent to Accounting` (H5). */
  @Post('tickets/:id/send-accounting')
  sendAcc(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: SendAccountingDto,
  ): Promise<{ status: string }> {
    return this.sendAccounting.execute({ ticketId: id, actorSub: user.sub, documentNo: dto.documentNo })
  }
}
