import { Injectable } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { isValidDocumentNo } from '../../domain/ticket/document-no'
import { AccountingRepo } from '../../infra/prisma/ticket/accounting.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { DocumentNoInvalidError } from '../core/ticket-errors'

/**
 * DCC3 records the Document No and sends the Payment file to ACC — this CLOSES the
 * ticket at `Sent to Accounting` in one hop (H5, Story 4.2). Reuses the shared
 * `submitToAccounting` repo (the `sendToAccounting` edge routes to the Payment
 * terminal by flow); no BOP, no `Completed`, and — via the notification matrix —
 * no Applicant email. Document No is free-form (non-empty); the DB UNIQUE index
 * is the real duplicate guard.
 */
@Injectable()
export class SendAccountingDcc3UseCase {
  constructor(
    private readonly repo: AccountingRepo,
    private readonly clock: SystemClock,
  ) {}

  execute(req: { ticketId: string; actorSub: string; documentNo: string }): Promise<{ status: string }> {
    const documentNo = req.documentNo.trim()
    if (!isValidDocumentNo(documentNo)) {
      throw new DocumentNoInvalidError('Vui lòng nhập Document No.')
    }
    return this.repo.submitToAccounting(
      req.ticketId,
      { sub: req.actorSub, activeRole: ROLE.Dcc3 },
      documentNo,
      this.clock.now(),
    )
  }
}
