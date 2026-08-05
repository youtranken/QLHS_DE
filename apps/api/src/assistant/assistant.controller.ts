import { Body, Controller, HttpCode, NotFoundException, Post, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../http/auth/auth.guard'
import { GetCurrentUser, type CurrentUser } from '../http/auth/current-user'
import { AssistantService, type AssistantReply } from './assistant.service'
import { AskDto } from './assistant.dto'

/** Trợ lý nội bộ (read-only, không LLM). Mọi tra cứu scope theo danh tính +
 *  activeRole của phiên (AuthGuard). `ASSISTANT_ENABLED=0` → tắt (404). */
@Controller('assistant')
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(private readonly svc: AssistantService) {}

  @Post('ask')
  @HttpCode(200)
  ask(@GetCurrentUser() user: CurrentUser, @Body() dto: AskDto): Promise<AssistantReply> {
    if (process.env.ASSISTANT_ENABLED === '0') throw new NotFoundException()
    return this.svc.ask({ sub: user.sub, roles: user.roles, activeRole: user.activeRole }, dto.text)
  }
}
