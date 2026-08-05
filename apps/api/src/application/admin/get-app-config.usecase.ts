import { Injectable } from '@nestjs/common'
import { AppConfigRepo } from '../../infra/prisma/config/app-config.repo'

/** The default VP name — also the token baked into the canonical status
 *  "Submitted to VP Andy", so an unset/blank config leaves every label unchanged. */
export const DEFAULT_VP_NAME = 'Andy'

export interface AppConfigView {
  vpName: string
}

@Injectable()
export class GetAppConfigUseCase {
  constructor(private readonly repo: AppConfigRepo) {}

  async execute(): Promise<AppConfigView> {
    const row = await this.repo.get()
    return { vpName: row?.vpName?.trim() || DEFAULT_VP_NAME }
  }
}
