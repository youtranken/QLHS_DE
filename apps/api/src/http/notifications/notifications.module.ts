import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { NotificationsController } from './notifications.controller'
import { NotificationRepo } from '../../infra/prisma/notify/notification.repo'
import { ListNotificationsUseCase } from '../../application/notify/list-notifications.usecase'
import { MarkNotificationsReadUseCase } from '../../application/notify/mark-notifications-read.usecase'

/** 2.2 notification center. AuthModule provides the cookie AuthGuard. */
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationRepo, ListNotificationsUseCase, MarkNotificationsReadUseCase],
  exports: [ListNotificationsUseCase],
})
export class NotificationsModule {}
