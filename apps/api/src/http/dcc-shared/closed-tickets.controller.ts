import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { SearchClosedTicketsUseCase, type ClosedPage } from '../../application/closed/search-closed-tickets.usecase'
import { ClosedFiltersDto } from './closed-filters.dto'

/** FR-17 lookup surface for DCC (1/2/3). Flow scope is enforced server-side by
 *  the use-case/repo (AD-16) — the FE never widens it. */
@Controller('tickets')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3)
export class ClosedTicketsController {
  constructor(private readonly search: SearchClosedTicketsUseCase) {}

  @Get('closed')
  closed(@GetCurrentUser() user: CurrentUser, @Query() q: ClosedFiltersDto): Promise<ClosedPage> {
    return this.search.execute(
      user.activeRole,
      {
        code: q.code,
        contractor: q.contractor,
        contractNo: q.contractNo,
        applicant: q.applicant,
        // Day-granularity bounds (server TZ = UTC): `from` = start of day, `to` =
        // end of day so a ticket created any time on the end date is INCLUDED.
        from: q.from ? new Date(`${q.from}T00:00:00.000Z`) : undefined,
        to: q.to ? new Date(`${q.to}T23:59:59.999Z`) : undefined,
      },
      { limit: q.limit, cursor: q.cursor },
    )
  }
}
