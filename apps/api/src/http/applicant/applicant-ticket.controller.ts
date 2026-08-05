import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ROLE, PRIORITY, type DocumentType, type Priority } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { CreateTicketUseCase } from '../../application/lifecycle/create-ticket.usecase'
import { CreateFromExistingUseCase } from '../../application/lifecycle/create-from-existing.usecase'
import { CancelTicketUseCase } from '../../application/lifecycle/cancel-ticket.usecase'
import { ChangePriorityUseCase } from '../../application/lifecycle/change-priority.usecase'
import { ConfirmReturnReceiptUseCase } from '../../application/returns/confirm-return-receipt.usecase'
import { ResubmitTicketUseCase } from '../../application/returns/resubmit-ticket.usecase'
import { UpdateFieldsUseCase } from '../../application/lifecycle/update-fields.usecase'
import { ListMyTicketsUseCase } from '../../application/lifecycle/list-my-tickets.usecase'
import { type TicketView } from '../../application/core/ticket-view'
import { ChangePriorityDto, CloneTicketDto, CreateTicketDto } from './create-ticket.dto'

@Controller('tickets')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Applicant)
export class ApplicantTicketController {
  constructor(
    private readonly createTicket: CreateTicketUseCase,
    private readonly createFromExisting: CreateFromExistingUseCase,
    private readonly cancelTicket: CancelTicketUseCase,
    private readonly changePriority: ChangePriorityUseCase,
    private readonly confirmReceipt: ConfirmReturnReceiptUseCase,
    private readonly resubmit: ResubmitTicketUseCase,
    private readonly updateFields: UpdateFieldsUseCase,
    private readonly listMine: ListMyTicketsUseCase,
  ) {}

  private toFields(dto: CreateTicketDto) {
    return {
      documentType: dto.documentType as DocumentType,
      description: dto.description,
      paymentTerm: dto.paymentTerm,
      contractNo: dto.contractNo,
      projectTeam: dto.projectTeam,
      currency: dto.currency,
      amount: BigInt(dto.amount),
      budgetCode: dto.budgetCode,
      contractor: dto.contractor,
    }
  }

  @Post()
  create(@GetCurrentUser() user: CurrentUser, @Body() dto: CreateTicketDto): Promise<{ id: string }> {
    return this.createTicket.execute({
      applicantSub: user.sub,
      priority: (dto.priority as Priority) ?? PRIORITY.Normal,
      fields: this.toFields(dto),
    })
  }

  @Post('from/:sourceId')
  clone(
    @GetCurrentUser() user: CurrentUser,
    @Param('sourceId') sourceId: string,
    @Body() dto: CloneTicketDto,
  ): Promise<{ id: string }> {
    return this.createFromExisting.execute({
      applicantSub: user.sub,
      sourceTicketId: sourceId,
      priority: dto.priority as Priority | undefined,
    })
  }

  @Get('mine')
  mine(@GetCurrentUser() user: CurrentUser): Promise<TicketView[]> {
    return this.listMine.execute(user.sub)
  }

  @Post(':id/cancel')
  async cancel(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.cancelTicket.execute({ ticketId: id, actorSub: user.sub })
    return { ok: true }
  }

  /** Return 2-phase step 2 (B3): Applicant confirms hardcopy back → Return-fixing. */
  @Post(':id/confirm-return-receipt')
  async confirmReturnReceipt(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.confirmReceipt.execute({ ticketId: id, actorSub: user.sub })
    return { ok: true }
  }

  /** Edit the 9 fields — while in Pool (Submitted) or at Return-fixing; each change audited (B6). */
  @Patch(':id')
  async edit(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CreateTicketDto,
  ): Promise<{ ok: true }> {
    await this.updateFields.execute({ ticketId: id, actorSub: user.sub, fields: this.toFields(dto) })
    return { ok: true }
  }

  @Post(':id/resubmit')
  async resubmitTicket(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.resubmit.execute({ ticketId: id, actorSub: user.sub })
    return { ok: true }
  }

  @Patch(':id/priority')
  async priority(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ChangePriorityDto,
  ): Promise<{ ok: true }> {
    await this.changePriority.execute({
      ticketId: id,
      actorSub: user.sub,
      priority: dto.priority as Priority,
    })
    return { ok: true }
  }
}
