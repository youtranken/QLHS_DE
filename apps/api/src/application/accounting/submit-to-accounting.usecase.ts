import { Injectable } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { isValidDocumentNo } from '../../domain/ticket/document-no'
import { AccountingRepo } from '../../infra/prisma/ticket/accounting.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { DocumentNoInvalidError } from '../core/ticket-errors'

/** DCC2 records the Document No and sends the Contract file to Accounting (FR-11).
 *  Free-form (non-empty) — the DB UNIQUE index is the real duplicate guard. */
@Injectable()
export class SubmitToAccountingUseCase {
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
      { sub: req.actorSub, activeRole: ROLE.Dcc2 },
      documentNo,
      this.clock.now(),
    )
  }
}
