import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { Role } from '@qlhs/contracts'

export interface CurrentUser {
  sub: string
  roles: Role[]
  activeRole: Role | null
  displayName?: string
}

declare module 'express' {
  interface Request {
    currentUser?: CurrentUser
    sessionId?: string
  }
}

/** Injects the authenticated user resolved by AuthGuard. */
export const GetCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser | undefined => {
    return ctx.switchToHttp().getRequest<Request>().currentUser
  },
)
