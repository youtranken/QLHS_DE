import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ROLE } from '@qlhs/contracts'
import { AuthGuard } from '../auth/auth.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import {
  DispatchMapUseCase,
  StationTicketsUseCase,
  type FlowLine,
  type StationTicket,
} from '../../application/dispatch/dispatch-map.usecase'
import { StationBoardUseCase, type BoardColumn } from '../../application/dispatch/station-board.usecase'

/** Read-only dispatch map + station popover + "Trạm của tôi" board.
 *  DCC roles only (Applicant → 403). */
@Controller()
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLE.Dcc1, ROLE.Dcc2, ROLE.Dcc3, ROLE.Admin)
export class DispatchController {
  constructor(
    private readonly map: DispatchMapUseCase,
    private readonly stationTickets: StationTicketsUseCase,
    private readonly board: StationBoardUseCase,
  ) {}

  @Get('station-board')
  stationBoard(@GetCurrentUser() user: CurrentUser): Promise<BoardColumn[]> {
    return this.board.execute(user.activeRole, user.sub)
  }

  @Get('dispatch-map')
  dispatchMap(@GetCurrentUser() user: CurrentUser): Promise<FlowLine[]> {
    return this.map.execute(user.activeRole)
  }

  @Get('stations/:status/tickets')
  station(
    @GetCurrentUser() user: CurrentUser,
    @Param('status') status: string,
    // Scope the popover to the clicked lane's flow so a shared station (e.g. the
    // unified Completed finish) doesn't mix tickets from other flows (F2).
    @Query('flow') flow?: string,
  ): Promise<StationTicket[]> {
    return this.stationTickets.execute(status, user.activeRole, flow)
  }
}
