import { Injectable } from '@nestjs/common'
import { AppConfigRepo } from '../../infra/prisma/config/app-config.repo'

/** Thrown when the VP name is blank or too long — the controller maps this to a
 *  400 with a clear message. */
export class InvalidVpNameError extends Error {
  readonly code = 'InvalidVpName'
  constructor() {
    super('Tên VP không hợp lệ (1–40 ký tự).')
  }
}

@Injectable()
export class UpdateAppConfigUseCase {
  constructor(private readonly repo: AppConfigRepo) {}

  async execute(vpName: string, actorSub: string): Promise<void> {
    const name = vpName.trim()
    if (name.length < 1 || name.length > 40) throw new InvalidVpNameError()
    await this.repo.upsert({ vpName: name, updatedBy: actorSub })
  }
}
