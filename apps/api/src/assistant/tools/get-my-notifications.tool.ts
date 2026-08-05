import { Injectable } from '@nestjs/common'
import { ALL_ROLES, type Role } from '@qlhs/contracts'
import { ListNotificationsUseCase } from '../../application/notify/list-notifications.usecase'
import { TOOL } from '../intent/types'
import { type AssistantTool, type Caller } from '../assistant-tool'

/** Thông báo của người hỏi — theo sub + TẤT CẢ vai (hộp thư vai). Tool duy nhất
 *  dùng `roles[]` thay vì chỉ `activeRole`. */
@Injectable()
export class GetMyNotificationsTool implements AssistantTool {
  readonly name = TOOL.Notifications
  readonly activeRoles: readonly Role[] = ALL_ROLES
  constructor(private readonly uc: ListNotificationsUseCase) {}

  run(_args: Record<string, unknown>, caller: Caller): Promise<unknown> {
    return this.uc.execute(caller.sub, caller.roles)
  }
}
