import { BadRequestException, Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { GetAppConfigUseCase, type AppConfigView } from '../../application/admin/get-app-config.usecase'
import { UpdateAppConfigUseCase, InvalidVpNameError } from '../../application/admin/update-app-config.usecase'
import { AppConfigDto } from './app-config.dto'

/** Admin › Cấu hình › Tên VP. SA-only. Single source for the VP display name;
 *  the canonical status "Submitted to VP Andy" (state machine/audit) is untouched. */
@Controller('admin/app-config')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Admin)
export class AdminAppConfigController {
  constructor(
    private readonly getConfig: GetAppConfigUseCase,
    private readonly updateConfig: UpdateAppConfigUseCase,
  ) {}

  @Get()
  get(): Promise<AppConfigView> {
    return this.getConfig.execute()
  }

  @Put()
  async update(@Body() dto: AppConfigDto, @GetCurrentUser() user: CurrentUser): Promise<{ ok: true }> {
    try {
      await this.updateConfig.execute(dto.vpName, user.sub)
      return { ok: true }
    } catch (e) {
      if (e instanceof InvalidVpNameError) throw new BadRequestException({ code: e.code, message: e.message })
      throw e
    }
  }
}
