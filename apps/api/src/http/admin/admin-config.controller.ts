import { BadRequestException, Body, Controller, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { GetSmtpConfigUseCase, type SmtpConfigView } from '../../application/admin/get-smtp-config.usecase'
import { UpdateSmtpConfigUseCase, SmtpEncKeyMissingError } from '../../application/admin/update-smtp-config.usecase'
import { TestSmtpUseCase } from '../../application/admin/test-smtp.usecase'
import { SmtpConfigDto, SmtpTestDto } from './smtp-config.dto'

/** Admin › Cấu hình › Email. SA-only. The password is write-only over the wire —
 *  GET never returns it (only `hasPassword`). */
@Controller('admin/smtp')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Admin)
export class AdminConfigController {
  constructor(
    private readonly getConfig: GetSmtpConfigUseCase,
    private readonly updateConfig: UpdateSmtpConfigUseCase,
    private readonly testSmtp: TestSmtpUseCase,
  ) {}

  @Get()
  get(): Promise<SmtpConfigView> {
    return this.getConfig.execute()
  }

  @Put()
  async update(@Body() dto: SmtpConfigDto, @GetCurrentUser() user: CurrentUser): Promise<{ ok: true }> {
    try {
      await this.updateConfig.execute(dto, user.sub)
      return { ok: true }
    } catch (e) {
      if (e instanceof SmtpEncKeyMissingError) throw new BadRequestException({ code: e.code, message: e.message })
      throw e
    }
  }

  @Post('test')
  @HttpCode(200)
  async test(@Body() dto: SmtpTestDto): Promise<{ ok: true }> {
    try {
      await this.testSmtp.execute(dto)
      return { ok: true }
    } catch (e) {
      // Surface the real SMTP error so the operator can fix host/port/auth.
      throw new BadRequestException({ code: 'SmtpTestFailed', message: (e as Error).message || 'Gửi thử thất bại.' })
    }
  }
}
