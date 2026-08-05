import { Controller, Get } from '@nestjs/common'
import { GetAppConfigUseCase, type AppConfigView } from '../../application/admin/get-app-config.usecase'

/** Public, secret-free app config the web reads at startup. Currently just the VP
 *  display name (default "Andy") so a rename shows on every UI surface at once. */
@Controller('config')
export class PublicConfigController {
  constructor(private readonly getConfig: GetAppConfigUseCase) {}

  @Get()
  get(): Promise<AppConfigView> {
    return this.getConfig.execute()
  }
}
