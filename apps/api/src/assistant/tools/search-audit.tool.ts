import { Injectable } from '@nestjs/common'
import { type Role } from '@qlhs/contracts'
import { SearchAuditUseCase } from '../../application/admin/search-audit.usecase'
import { TOOL, TOOL_ROLES } from '../intent/types'
import { type AssistantTool } from '../assistant-tool'

/** Nhật ký thao tác gần đây (Admin). Pha 2: không lọc — trang đầu, mới nhất. */
@Injectable()
export class SearchAuditTool implements AssistantTool {
  readonly name = TOOL.Audit
  readonly activeRoles: readonly Role[] = TOOL_ROLES[TOOL.Audit]
  constructor(private readonly uc: SearchAuditUseCase) {}

  run(): Promise<unknown> {
    return this.uc.execute({}, 1)
  }
}
