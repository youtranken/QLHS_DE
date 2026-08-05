import { Injectable } from '@nestjs/common'
import { SlaRepo, type SlaConfigRow } from '../../infra/prisma/sla/sla.repo'

/** Admin reads every configured (status, flow) SLA threshold (Story 5.1). */
@Injectable()
export class GetSlaConfigUseCase {
  constructor(private readonly repo: SlaRepo) {}

  execute(): Promise<SlaConfigRow[]> {
    return this.repo.list()
  }
}
