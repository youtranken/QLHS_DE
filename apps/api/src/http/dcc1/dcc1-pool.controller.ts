import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ROLE, type Priority } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { ListPoolUseCase, type PoolCard } from '../../application/board/list-pool.usecase'
import { PickFromPoolUseCase } from '../../application/board/pick-from-pool.usecase'
import { SeizeLockUseCase } from '../../application/board/seize-lock.usecase'
import { DccAdjustPriorityUseCase } from '../../application/board/dcc-adjust-priority.usecase'
import { ConfirmFlowUseCase } from '../../application/board/confirm-flow.usecase'
import { TransitionTicketUseCase } from '../../application/core/transition-ticket.usecase'
import { ReopenTicketUseCase } from '../../application/closed/reopen-ticket.usecase'
import { ResendToDcc2UseCase } from '../../application/handover/resend-to-dcc2.usecase'
import { ResendToDcc3UseCase } from '../../application/handover/resend-to-dcc3.usecase'
import { ReceiveFromAccUseCase } from '../../application/accounting/receive-from-acc.usecase'
import { ReturnFromPushbackUseCase } from '../../application/returns/return-from-pushback.usecase'
import { UndoActionUseCase } from '../../application/board/undo-action.usecase'
import { BatchActionUseCase, type BatchResult } from '../../application/board/batch-action.usecase'
import { ListWorkboxUseCase, type WorkboxCard } from '../../application/board/list-workbox.usecase'
import { ChangePriorityDto } from '../applicant/create-ticket.dto'
import { BatchActionDto, ReasonDto, ReceiveDateDto, TicketActionDto } from '../dcc-shared/ticket-action.dto'
import type { TicketEvent } from '@qlhs/contracts'

@Controller('dcc1')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Dcc1)
export class Dcc1PoolController {
  constructor(
    private readonly listPool: ListPoolUseCase,
    private readonly pick: PickFromPoolUseCase,
    private readonly seize: SeizeLockUseCase,
    private readonly adjust: DccAdjustPriorityUseCase,
    private readonly confirmFlow: ConfirmFlowUseCase,
    private readonly transition: TransitionTicketUseCase,
    private readonly reopen: ReopenTicketUseCase,
    private readonly resend: ResendToDcc2UseCase,
    private readonly resendDcc3UseCase: ResendToDcc3UseCase,
    private readonly receiveFromAcc: ReceiveFromAccUseCase,
    private readonly returnPushback: ReturnFromPushbackUseCase,
    private readonly undo: UndoActionUseCase,
    private readonly batch: BatchActionUseCase,
    private readonly workbox: ListWorkboxUseCase,
  ) {}

  @Get('workbox')
  station(): Promise<WorkboxCard[]> {
    return this.workbox.execute()
  }

  @Post('tickets/:id/action')
  async action(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: TicketActionDto,
  ): Promise<{ status: string }> {
    const t = await this.transition.execute({
      ticketId: id,
      event: dto.event as TicketEvent,
      actor: { sub: user.sub, activeRole: ROLE.Dcc1 },
      reason: dto.reason,
    })
    return { status: t.status }
  }

  @Post('tickets/action')
  batchAction(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: BatchActionDto,
  ): Promise<BatchResult[]> {
    return this.batch.execute({
      ticketIds: dto.ticketIds,
      event: dto.event as TicketEvent,
      actor: { sub: user.sub, activeRole: ROLE.Dcc1 },
      reason: dto.reason,
    })
  }

  /** Reopen a closed ticket (FR-17): Completed → Reopened → Returned, new round. */
  @Post('tickets/:id/reopen')
  async reopenTicket(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ): Promise<{ status: string }> {
    const t = await this.reopen.execute({
      ticketId: id,
      actor: { sub: user.sub, activeRole: ROLE.Dcc1 },
      reason: dto.reason ?? '',
    })
    return { status: t.status }
  }

  /** DCC1 takes the hardcopy back from ACC (Story 3.3), recording the date. */
  @Post('tickets/:id/receive-from-acc')
  async receiveAcc(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ReceiveDateDto,
  ): Promise<{ status: string }> {
    const t = await this.receiveFromAcc.execute({
      ticketId: id,
      actorSub: user.sub,
      receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
    })
    return { status: t.status }
  }

  /** Re-hand over a reconciled ticket to DCC2 after "missing paper" (Story 3.1). */
  @Post('tickets/:id/resend-dcc2')
  async resendDcc2(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.resend.execute({ ticketId: id, actorSub: user.sub })
    return { ok: true }
  }

  /** Re-hand over a reconciled Payment ticket to DCC3 after "missing paper". */
  @Post('tickets/:id/resend-dcc3')
  async resendDcc3(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.resendDcc3UseCase.execute({ ticketId: id, actorSub: user.sub })
    return { ok: true }
  }

  /** Resolve a DCC2 push-back (AC4): clear the flag + Return, one transaction. */
  @Post('tickets/:id/return-pushback')
  returnPushedBack(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ): Promise<{ status: string }> {
    return this.returnPushback.execute({ ticketId: id, actorSub: user.sub, reason: dto.reason ?? '' })
  }

  /** Undo the most recent reversible action within 5s (AD-19). */
  @Post('tickets/:id/undo')
  async undoAction(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ status: string }> {
    const t = await this.undo.execute({ ticketId: id, actor: { sub: user.sub, activeRole: ROLE.Dcc1 } })
    return { status: t.status }
  }

  @Post('pool/:id/confirm')
  confirm(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ code: string; status: string }> {
    return this.confirmFlow.execute({
      ticketId: id,
      actor: { sub: user.sub, activeRole: ROLE.Dcc1 },
    })
  }

  @Get('pool')
  pool(@GetCurrentUser() user: CurrentUser): Promise<PoolCard[]> {
    return this.listPool.execute(user.sub)
  }

  @Post('pool/:id/pick')
  async pickTicket(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    const res = await this.pick.execute({ ticketId: id, actorSub: user.sub })
    if (!res.picked) {
      throw new ConflictException({
        code: 'AlreadyPicked',
        message: res.heldBy ? `Đang được ${res.heldBy} xử lý` : 'Hồ sơ không còn ở Pool',
      })
    }
    return { ok: true }
  }

  @Post('tickets/:id/seize')
  seizeLock(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ acquired: boolean; holderSub: string; seized: boolean }> {
    return this.seize.execute({ ticketId: id, actorSub: user.sub })
  }

  @Patch('tickets/:id/priority')
  async priority(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ChangePriorityDto,
  ): Promise<{ ok: true }> {
    await this.adjust.execute({ ticketId: id, actorSub: user.sub, priority: dto.priority as Priority })
    return { ok: true }
  }
}
