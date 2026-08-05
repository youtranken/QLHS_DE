import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { WebhookController } from './webhook.controller'
import { DigestPrefController } from './digest-pref.controller'
import { AuthGuard } from './auth.guard'
import { RolesGuard } from './roles.guard'
import { AdminController } from '../admin/admin.controller'
import { AdminConfigController } from '../admin/admin-config.controller'
import { GetSmtpConfigUseCase } from '../../application/admin/get-smtp-config.usecase'
import { UpdateSmtpConfigUseCase } from '../../application/admin/update-smtp-config.usecase'
import { TestSmtpUseCase } from '../../application/admin/test-smtp.usecase'
import { SmtpConfigRepo } from '../../infra/prisma/config/smtp-config.repo'
import { SessionStore } from '../../infra/session/session.store'
import { SessionAuthService } from '../../infra/session/session-auth.service'
import { UserRoleRepo } from '../../infra/prisma/users/user-role.repo'
import { PmhIdIdentity } from '../../infra/pmh-id/pmh-id.identity'
import { OidcStateStore } from '../../infra/pmh-id/oidc-state.store'
import { LoginThrottle } from '../../infra/auth/login-throttle'
import { DirectoryClient } from '../../infra/pmh-id/directory.client'
import { LocalCredentialRepo } from '../../infra/prisma/users/local-credential.repo'
import { LocalAdminBootstrap } from '../../infra/auth/local-admin.bootstrap'
import { ListUsersUseCase } from '../../application/admin/list-users.usecase'
import { LocalLoginUseCase } from '../../application/auth/local-login.usecase'
import { GetSlaConfigUseCase } from '../../application/admin/get-sla-config.usecase'
import { UpdateSlaConfigUseCase } from '../../application/admin/update-sla-config.usecase'
import { GetAdminOverviewUseCase } from '../../application/admin/get-admin-overview.usecase'
import { SearchAuditUseCase } from '../../application/admin/search-audit.usecase'
import { ListOptionsUseCase } from '../../application/admin/list-options.usecase'
import { CreateOptionUseCase, UpdateOptionUseCase } from '../../application/admin/mutate-option.usecase'
import { GetDocumentTypesUseCase } from '../../application/admin/get-document-types.usecase'
import { AddDocumentTypeUseCase } from '../../application/admin/add-document-type.usecase'
import { SearchDirectoryUseCase } from '../../application/admin/search-directory.usecase'
import { ListSlaPausesUseCase } from '../../application/sla/list-sla-pauses.usecase'
import { GetAnalyticsUseCase } from '../../application/admin/get-analytics.usecase'
import { ExportAnalyticsUseCase } from '../../application/admin/export-analytics.usecase'
import { AnalyticsRepo } from '../../infra/prisma/admin/analytics.repo'
import { SlaPauseRepo } from '../../infra/prisma/sla/sla-pause.repo'
import { SlaClock } from '../../application/sla/sla-clock'
import { OptionsController } from '../options/options.controller'
import { SlaRepo } from '../../infra/prisma/sla/sla.repo'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { AuditRepo } from '../../infra/prisma/admin/audit.repo'
import { OutboxRepo } from '../../infra/prisma/notify/outbox.repo'
import { OptionRepo } from '../../infra/prisma/admin/option.repo'
import { OptionsBootstrap } from '../../infra/prisma/admin/options.bootstrap'
import { SystemClock } from '../../infra/clock/system-clock'
import { UserDirectoryRepo } from '../../infra/prisma/users/user-directory.repo'
import { ProcessedWebhookEventRepo } from '../../infra/prisma/webhook/processed-event.repo'

@Module({
  controllers: [AuthController, WebhookController, AdminController, AdminConfigController, OptionsController, DigestPrefController],
  providers: [
    AuthGuard,
    RolesGuard,
    SessionStore,
    // refresh capability comes from PmhIdIdentity; interface dep needs a factory.
    {
      provide: SessionAuthService,
      useFactory: (sessions: SessionStore, pmhId: PmhIdIdentity) =>
        new SessionAuthService(sessions, pmhId),
      inject: [SessionStore, PmhIdIdentity],
    },
    UserRoleRepo,
    ProcessedWebhookEventRepo,
    PmhIdIdentity,
    OidcStateStore,
    LoginThrottle,
    DirectoryClient,
    LocalCredentialRepo,
    LocalLoginUseCase,
    LocalAdminBootstrap,
    ListUsersUseCase,
    GetSlaConfigUseCase,
    UpdateSlaConfigUseCase,
    GetAdminOverviewUseCase,
    SearchAuditUseCase,
    ListOptionsUseCase,
    CreateOptionUseCase,
    GetDocumentTypesUseCase,
    AddDocumentTypeUseCase,
    UpdateOptionUseCase,
    SearchDirectoryUseCase,
    ListSlaPausesUseCase,
    GetAnalyticsUseCase,
    ExportAnalyticsUseCase,
    GetSmtpConfigUseCase,
    UpdateSmtpConfigUseCase,
    TestSmtpUseCase,
    SmtpConfigRepo,
    AnalyticsRepo,
    SlaPauseRepo,
    SlaClock,
    SlaRepo,
    TicketQueryRepo,
    AuditRepo,
    OutboxRepo,
    OptionRepo,
    OptionsBootstrap,
    SystemClock,
    UserDirectoryRepo,
  ],
  exports: [
    AuthGuard,
    // AuthGuard is used via @UseGuards in importing modules (Events, Notifications);
    // its deps must be resolvable there too — SessionAuthService is now one of them.
    SessionAuthService,
    SessionStore,
    UserRoleRepo,
    // Đọc admin dùng lại bởi AssistantModule (trợ lý nội bộ, read-only).
    GetAdminOverviewUseCase,
    SearchAuditUseCase,
    ListSlaPausesUseCase,
    GetAnalyticsUseCase,
  ],
})
export class AuthModule {}
