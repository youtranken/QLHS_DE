import { type Role } from '@qlhs/contracts'

export interface Caller {
  sub: string
  roles: Role[]
  activeRole: Role | null
}

/** Bọc mỏng quanh MỘT use-case đọc; trả dữ liệu thô cho lớp render. Read-only. */
export interface AssistantTool {
  readonly name: string
  readonly activeRoles: readonly Role[]
  run(args: Record<string, unknown>, caller: Caller): Promise<unknown>
}
