import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ROLE } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { CheckDocumentNosUseCase } from '../../application/accounting/check-document-nos.usecase'
import { CheckDocumentNosDto } from './check-document-nos.dto'

/** Read-only pre-flight for the batch send-to-Accounting sheet: which Document Nos
 *  are already taken. DCC2 (Contract) + DCC3 (Payment) are the enterers; Admin can
 *  drive either board. Document No uniqueness is global, so no flow scope needed. */
@Controller('tickets')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Dcc2, ROLE.Dcc3, ROLE.Admin)
export class DocumentCheckController {
  constructor(private readonly check: CheckDocumentNosUseCase) {}

  // It is a pure existence probe (returns which of the caller's numbers already
  // exist), so it reads as 200, not 201. A per-handler throttle well below the
  // global 300/min blunts using it to enumerate the document-number space.
  @Post('check-document-nos')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async checkDocumentNos(@Body() dto: CheckDocumentNosDto): Promise<{ existing: string[] }> {
    return { existing: await this.check.execute(dto.documentNos) }
  }
}
