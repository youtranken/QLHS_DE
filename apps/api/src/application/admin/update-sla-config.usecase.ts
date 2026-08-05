import { Injectable } from '@nestjs/common'
import { ALL_FLOWS, ALL_STATUSES } from '@qlhs/contracts'
import { isValidSlaDays } from '../../domain/sla/sla-config'
import { SlaRepo } from '../../infra/prisma/sla/sla.repo'
import { SlaConfigKeyInvalidError, SlaDaysInvalidError } from '../core/ticket-errors'

/** Valid `flow` keys: the '*' baseline plus each real flow (B1). */
const VALID_FLOWS: ReadonlySet<string> = new Set<string>(['*', ...ALL_FLOWS])
const VALID_STATUSES: ReadonlySet<string> = new Set<string>(ALL_STATUSES)

/**
 * Admin sets one (status, flow) SLA threshold (Story 5.1). Guards `slaDays > 0`
 * (the domain rule — the DTO mirrors it as an early layer); on invalid input the
 * old value is untouched (AC3). No cache → the next badge read uses it (AC1).
 */
@Injectable()
export class UpdateSlaConfigUseCase {
  constructor(private readonly repo: SlaRepo) {}

  execute(req: { status: string; flow: string; slaDays: number; adminSub: string }): Promise<void> {
    if (!VALID_FLOWS.has(req.flow) || !VALID_STATUSES.has(req.status)) {
      throw new SlaConfigKeyInvalidError(`(status, flow) không hợp lệ: (${req.status}, ${req.flow})`)
    }
    if (!isValidSlaDays(req.slaDays)) {
      throw new SlaDaysInvalidError('Số ngày SLA phải là số nguyên dương')
    }
    return this.repo.upsert(req.status, req.flow, req.slaDays, req.adminSub)
  }
}
