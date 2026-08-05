import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import {
  ListNotificationsUseCase,
  type NotificationList,
} from '../../application/notify/list-notifications.usecase'
import { MarkNotificationsReadUseCase } from '../../application/notify/mark-notifications-read.usecase'

/** 2.2 — the notification bell. Everything is scoped to the caller's own sub +
 *  roles (AuthGuard), so nobody can read or clear someone else's notifications. */
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    private readonly list: ListNotificationsUseCase,
    private readonly markRead: MarkNotificationsReadUseCase,
  ) {}

  @Get()
  get(@GetCurrentUser() user: CurrentUser): Promise<NotificationList> {
    return this.list.execute(user.sub, user.roles)
  }

  @Post('read')
  @HttpCode(200)
  async readAll(@GetCurrentUser() user: CurrentUser): Promise<{ ok: true }> {
    await this.markRead.markAll(user.sub, user.roles)
    return { ok: true }
  }

  @Post(':id/read')
  @HttpCode(200)
  async readOne(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.markRead.markOne(user.sub, user.roles, id)
    return { ok: true }
  }
}
