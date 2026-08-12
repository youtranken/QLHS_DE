import { Module } from '@nestjs/common'
import { AuthModule } from './http/auth/auth.module'
import { TransitionTicketUseCase } from './application/core/transition-ticket.usecase'
import { CreateTicketUseCase } from './application/lifecycle/create-ticket.usecase'
import { FlowResolver } from './application/lifecycle/flow-resolver'
import { OptionRepo } from './infra/prisma/admin/option.repo'
import { CreateFromExistingUseCase } from './application/lifecycle/create-from-existing.usecase'
import { CancelTicketUseCase } from './application/lifecycle/cancel-ticket.usecase'
import { ChangePriorityUseCase } from './application/lifecycle/change-priority.usecase'
import { ConfirmReturnReceiptUseCase } from './application/returns/confirm-return-receipt.usecase'
import { ResubmitTicketUseCase } from './application/returns/resubmit-ticket.usecase'
import { UpdateFieldsUseCase } from './application/lifecycle/update-fields.usecase'
import { PickFromPoolUseCase } from './application/board/pick-from-pool.usecase'
import { SeizeLockUseCase } from './application/board/seize-lock.usecase'
import { ListPoolUseCase } from './application/board/list-pool.usecase'
import { ScanDuplicatesUseCase } from './application/board/scan-duplicates.usecase'
import { SlaClock } from './application/sla/sla-clock'
import { SlaPauseRepo } from './infra/prisma/sla/sla-pause.repo'
import { PauseSlaUseCase, ResumeSlaUseCase } from './application/sla/sla-pause.usecase'
import { SlaPauseController } from './http/dcc-shared/sla-pause.controller'
import { DccAdjustPriorityUseCase } from './application/board/dcc-adjust-priority.usecase'
import { ConfirmFlowUseCase } from './application/board/confirm-flow.usecase'
import { ReopenTicketUseCase } from './application/closed/reopen-ticket.usecase'
import { ConfirmReceivedByDcc2UseCase } from './application/handover/confirm-received-dcc2.usecase'
import { ReportMissingPaperUseCase } from './application/handover/report-missing-paper.usecase'
import { ResendToDcc2UseCase } from './application/handover/resend-to-dcc2.usecase'
import { ConfirmReceivedByDcc3UseCase } from './application/handover/confirm-received-dcc3.usecase'
import { ReportMissingPaperDcc3UseCase } from './application/handover/report-missing-paper-dcc3.usecase'
import { ResendToDcc3UseCase } from './application/handover/resend-to-dcc3.usecase'
import { SendAccountingDcc3UseCase } from './application/accounting/send-accounting-dcc3.usecase'
import { SubmitToAccountingUseCase } from './application/accounting/submit-to-accounting.usecase'
import { ReceiveFromAccUseCase } from './application/accounting/receive-from-acc.usecase'
import { CompleteContractUseCase } from './application/accounting/complete-contract.usecase'
import { CheckDocumentNosUseCase } from './application/accounting/check-document-nos.usecase'
import { ReturnFromPushbackUseCase } from './application/returns/return-from-pushback.usecase'
import { UndoActionUseCase } from './application/board/undo-action.usecase'
import { BatchActionUseCase } from './application/board/batch-action.usecase'
import { BatchDcc2UseCase } from './application/board/batch-dcc2.usecase'
import { BatchDcc3UseCase } from './application/board/batch-dcc3.usecase'
import { ListWorkboxUseCase } from './application/board/list-workbox.usecase'
import { TicketDetailUseCase } from './application/core/ticket-detail.usecase'
import { ListMyTicketsUseCase } from './application/lifecycle/list-my-tickets.usecase'
import { SearchClosedTicketsUseCase } from './application/closed/search-closed-tickets.usecase'
import { LegalActionsUseCase } from './application/core/legal-actions.usecase'
import { DispatchMapUseCase, StationTicketsUseCase } from './application/dispatch/dispatch-map.usecase'
import { StationBoardUseCase } from './application/dispatch/station-board.usecase'
import { TicketTransitionRepo } from './infra/prisma/ticket/ticket-transition.repo'
import { TicketQueryRepo } from './infra/prisma/ticket/ticket-query.repo'
import { TicketWriteRepo } from './infra/prisma/ticket/ticket-write.repo'
import { TicketViewRepo } from './infra/prisma/ticket/ticket-view.repo'
import { UserDirectoryRepo } from './infra/prisma/users/user-directory.repo'
import { UserRoleRepo } from './infra/prisma/users/user-role.repo'
import { HandoverRepo } from './infra/prisma/ticket/handover.repo'
import { AccountingRepo } from './infra/prisma/ticket/accounting.repo'
import { CompleteContractRepo } from './infra/prisma/ticket/complete-contract.repo'
import { LockRepo } from './infra/prisma/ticket/lock.repo'
import { SlaRepo } from './infra/prisma/sla/sla.repo'
import { ConfirmFlowRepo } from './infra/prisma/ticket/confirm-flow.repo'
import { SystemClock } from './infra/clock/system-clock'
import { MailPort } from './domain/ports/mail.port'
import { NodemailerMailPort } from './infra/mail/nodemailer.mail'
import { SmtpResolver } from './infra/mail/smtp-resolver'
import { SmtpConfigRepo } from './infra/prisma/config/smtp-config.repo'
import { OutboxDispatcher } from './infra/scheduler/outbox.dispatcher'
import { ReturnReminderScheduler } from './infra/scheduler/return-reminder.scheduler'
import { PoolAutoReturnScheduler } from './infra/scheduler/pool-auto-return.scheduler'
import { EscalationScheduler } from './infra/scheduler/escalation.scheduler'
import { DigestScheduler } from './infra/scheduler/digest.scheduler'
import { DigestDispatcher } from './infra/scheduler/digest.dispatcher'
import { DigestOutboxRepo } from './infra/prisma/notify/digest-outbox.repo'
import { BuildDigestUseCase } from './application/notify/build-digest.usecase'
import { RolesGuard } from './http/auth/roles.guard'
import { ApplicantTicketController } from './http/applicant/applicant-ticket.controller'
import { Dcc1PoolController } from './http/dcc1/dcc1-pool.controller'
import { Dcc2Controller } from './http/dcc2/dcc2.controller'
import { Dcc3Controller } from './http/dcc3/dcc3.controller'
import { TicketDetailController } from './http/ticket/ticket-detail.controller'
import { ClosedTicketsController } from './http/dcc-shared/closed-tickets.controller'
import { DocumentCheckController } from './http/dcc-shared/document-check.controller'
import { DispatchController } from './http/dispatch/dispatch.controller'

@Module({
  imports: [AuthModule],
  controllers: [
    ApplicantTicketController,
    Dcc1PoolController,
    Dcc2Controller,
    Dcc3Controller,
    TicketDetailController,
    SlaPauseController,
    ClosedTicketsController,
    DocumentCheckController,
    DispatchController,
  ],
  providers: [
    TransitionTicketUseCase,
    CreateTicketUseCase,
    FlowResolver,
    OptionRepo,
    CreateFromExistingUseCase,
    CancelTicketUseCase,
    ChangePriorityUseCase,
    ConfirmReturnReceiptUseCase,
    ResubmitTicketUseCase,
    UpdateFieldsUseCase,
    PickFromPoolUseCase,
    SeizeLockUseCase,
    ListPoolUseCase,
    ScanDuplicatesUseCase,
    SlaClock,
    SlaPauseRepo,
    PauseSlaUseCase,
    ResumeSlaUseCase,
    DccAdjustPriorityUseCase,
    ConfirmFlowUseCase,
    ReopenTicketUseCase,
    ConfirmReceivedByDcc2UseCase,
    ReportMissingPaperUseCase,
    ResendToDcc2UseCase,
    ConfirmReceivedByDcc3UseCase,
    ReportMissingPaperDcc3UseCase,
    ResendToDcc3UseCase,
    SendAccountingDcc3UseCase,
    SubmitToAccountingUseCase,
    ReceiveFromAccUseCase,
    CompleteContractUseCase,
    CheckDocumentNosUseCase,
    ReturnFromPushbackUseCase,
    UndoActionUseCase,
    BatchActionUseCase,
    BatchDcc2UseCase,
    BatchDcc3UseCase,
    ListWorkboxUseCase,
    TicketDetailUseCase,
    ListMyTicketsUseCase,
    SearchClosedTicketsUseCase,
    LegalActionsUseCase,
    DispatchMapUseCase,
    StationTicketsUseCase,
    StationBoardUseCase,
    TicketTransitionRepo,
    TicketQueryRepo,
    TicketWriteRepo,
    TicketViewRepo,
    UserDirectoryRepo,
    UserRoleRepo,
    HandoverRepo,
    AccountingRepo,
    CompleteContractRepo,
    LockRepo,
    SlaRepo,
    ConfirmFlowRepo,
    SystemClock,
    OutboxDispatcher,
    ReturnReminderScheduler,
    PoolAutoReturnScheduler,
    EscalationScheduler,
    DigestScheduler,
    DigestDispatcher,
    DigestOutboxRepo,
    BuildDigestUseCase,
    SmtpConfigRepo,
    SmtpResolver,
    { provide: MailPort, useClass: NodemailerMailPort },
    RolesGuard,
  ],
  exports: [
    TransitionTicketUseCase,
    TicketTransitionRepo,
    TicketQueryRepo,
    TicketWriteRepo,
    LockRepo,
    // Đọc dùng lại bởi AssistantModule (trợ lý nội bộ, read-only).
    ListMyTicketsUseCase,
    TicketDetailUseCase,
    SearchClosedTicketsUseCase,
    ListWorkboxUseCase,
    StationBoardUseCase,
    DispatchMapUseCase,
    StationTicketsUseCase,
  ],
})
export class TicketModule {}
