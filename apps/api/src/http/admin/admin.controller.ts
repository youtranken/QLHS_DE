import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ROLE, type Role } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { UserRoleRepo } from '../../infra/prisma/users/user-role.repo'
import { type SlaConfigRow } from '../../infra/prisma/sla/sla.repo'
import { ListUsersUseCase, type AdminUserRow } from '../../application/admin/list-users.usecase'
import { GetSlaConfigUseCase } from '../../application/admin/get-sla-config.usecase'
import { UpdateSlaConfigUseCase } from '../../application/admin/update-sla-config.usecase'
import {
  GetAdminOverviewUseCase,
  type AdminOverviewData,
} from '../../application/admin/get-admin-overview.usecase'
import { SearchAuditUseCase, type AuditPage } from '../../application/admin/search-audit.usecase'
import { ListOptionsUseCase, type OptionView } from '../../application/admin/list-options.usecase'
import { CreateOptionUseCase, UpdateOptionUseCase } from '../../application/admin/mutate-option.usecase'
import { SearchDirectoryUseCase, type DirectoryMatch } from '../../application/admin/search-directory.usecase'
import { ListSlaPausesUseCase, type SlaPauseReport } from '../../application/sla/list-sla-pauses.usecase'
import { GetAnalyticsUseCase, type AnalyticsData } from '../../application/admin/get-analytics.usecase'
import { ExportAnalyticsUseCase } from '../../application/admin/export-analytics.usecase'
import { isOptionKind, type OptionRow } from '../../infra/prisma/admin/option.repo'
import { CreateOptionDto, UpdateOptionDto } from './option.dto'
import { AnalyticsQueryDto, AnalyticsExportDto } from './analytics-query.dto'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { SetRolesDto } from './set-roles.dto'
import { UpdateSlaDto } from './update-sla.dto'
import { AuditFilterDto } from './audit-filter.dto'
import { assertNotSelfLockout } from '../../domain/admin/self-lockout'

/** Local SA console: see all SSO users (Directory) and assign QLHS roles; edit the
 *  SLA thresholds that drive the overdue badge (Story 5.1). Admin-only (AD-7). */
@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Admin)
export class AdminController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly userRoles: UserRoleRepo,
    private readonly getSla: GetSlaConfigUseCase,
    private readonly updateSla: UpdateSlaConfigUseCase,
    private readonly getOverview: GetAdminOverviewUseCase,
    private readonly searchAudit: SearchAuditUseCase,
    private readonly listOptions: ListOptionsUseCase,
    private readonly createOption: CreateOptionUseCase,
    private readonly updateOption: UpdateOptionUseCase,
    private readonly searchDirectory: SearchDirectoryUseCase,
    private readonly listPauses: ListSlaPausesUseCase,
    private readonly getAnalytics: GetAnalyticsUseCase,
    private readonly exportAnalytics: ExportAnalyticsUseCase,
  ) {}

  @Get('appoint/search')
  appointSearch(@Query('q') q?: string): Promise<DirectoryMatch[]> {
    return this.searchDirectory.execute(q ?? '')
  }

  @Get('options/:kind')
  options(@Param('kind') kind: string): Promise<OptionView[]> {
    assertKind(kind)
    return this.listOptions.execute(kind)
  }

  @Post('options/:kind')
  addOption(@Param('kind') kind: string, @Body() dto: CreateOptionDto): Promise<OptionRow> {
    assertKind(kind)
    return this.createOption.execute(kind, dto.value)
  }

  @Patch('options/:id')
  patchOption(@Param('id') id: string, @Body() dto: UpdateOptionDto): Promise<OptionRow> {
    return this.updateOption.execute(id, { value: dto.value, active: dto.active })
  }

  @Get('audit')
  audit(@Query() q: AuditFilterDto): Promise<AuditPage> {
    // Day bounds (server TZ = UTC): `from` = start of day, `to` = end of day so the
    // whole inclusive end date is covered. DTO already vetted these as YYYY-MM-DD.
    return this.searchAudit.execute(
      {
        code: q.code,
        actorSub: q.sub,
        event: q.event,
        from: q.from ? new Date(`${q.from}T00:00:00.000Z`) : undefined,
        to: q.to ? new Date(`${q.to}T23:59:59.999Z`) : undefined,
      },
      Number(q.page) || 1,
    )
  }

  @Get('overview')
  async overview(): Promise<AdminOverviewData & { system: { version: string; uptimeSeconds: number } }> {
    const data = await this.getOverview.execute()
    return {
      ...data,
      // Process-level status lives at the HTTP edge, not the use-case (no IO leak).
      system: {
        version: process.env.APP_VERSION ?? 'dev',
        uptimeSeconds: Math.floor(process.uptime()),
      },
    }
  }

  /** F8 oversight: pause is the one action that improves an SLA badge without
   *  work being done, so an Admin must be able to see every stopped clock. */
  @Get('sla-pauses')
  slaPauses(): Promise<SlaPauseReport> {
    return this.listPauses.execute()
  }

  /** 2.4 — management analytics (dwell heatmap · throughput · return rate · top
   *  overdue), all derived from ticket_event at read (AD-6). */
  @Get('analytics')
  analytics(@Query() q: AnalyticsQueryDto): Promise<AnalyticsData> {
    return this.getAnalytics.execute(q.granularity ?? 'month')
  }

  /** CSV of the raw event window (Excel-friendly, UTF-8 BOM). Defaults to a wide
   *  window when a bound is omitted so an unfiltered click still returns data. */
  @Get('analytics/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="qlhs-analytics.csv"')
  exportCsv(@Query() q: AnalyticsExportDto): Promise<string> {
    const from = q.from ? new Date(`${q.from}T00:00:00.000Z`) : new Date('2000-01-01T00:00:00.000Z')
    const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date('2999-12-31T23:59:59.999Z')
    return this.exportAnalytics.execute(from, to)
  }

  @Get('users')
  users(): Promise<AdminUserRow[]> {
    return this.listUsers.execute()
  }

  @Put('users/:sub/roles')
  async setRoles(
    @GetCurrentUser() user: CurrentUser,
    @Param('sub') sub: string,
    @Body() dto: SetRolesDto,
  ): Promise<{ ok: true }> {
    assertNotSelfLockout(user.sub, sub, dto.roles as Role[])
    await this.userRoles.setRoles(sub, dto.roles as Role[])
    return { ok: true }
  }

  @Get('sla-config')
  slaConfig(): Promise<SlaConfigRow[]> {
    return this.getSla.execute()
  }

  @Put('sla-config/:flow/:status')
  async setSla(
    @GetCurrentUser() user: CurrentUser,
    @Param('flow') flow: string,
    @Param('status') status: string,
    @Body() dto: UpdateSlaDto,
  ): Promise<{ ok: true }> {
    await this.updateSla.execute({ status, flow, slaDays: dto.slaDays, adminSub: user.sub })
    return { ok: true }
  }
}

/** Reject an unknown option `kind` early with a 400 (only paymentTerm/projectTeam). */
function assertKind(kind: string): void {
  if (!isOptionKind(kind)) {
    throw new BadRequestException({ code: 'InvalidOptionKind', message: 'Loại danh mục không hợp lệ' })
  }
}
