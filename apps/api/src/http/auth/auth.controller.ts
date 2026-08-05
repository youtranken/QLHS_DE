import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { Throttle } from '@nestjs/throttler'
import { ALL_ROLES, ROLE, type Role } from '@qlhs/contracts'
import { SessionStore } from '../../infra/session/session.store'
import { UserRoleRepo } from '../../infra/prisma/users/user-role.repo'
import { UserDirectoryRepo } from '../../infra/prisma/users/user-directory.repo'
import { PmhIdIdentity } from '../../infra/pmh-id/pmh-id.identity'
import { OidcStateStore } from '../../infra/pmh-id/oidc-state.store'
import { LoginThrottle } from '../../infra/auth/login-throttle'
import { LocalLoginUseCase } from '../../application/auth/local-login.usecase'
import { loadAuthConfig } from '../../config/auth.config'
import { effectiveRoles, resolveActiveRole } from '../../domain/auth/roles'
import { isGroupAllowed } from '../../domain/auth/group-access'
import { throttleDisabled } from '../common/throttle-flag'
import { AuthGuard } from './auth.guard'
import type { CurrentUser } from './current-user'

/** Client IP for per-IP lockout. `trust proxy` (main.ts) makes req.ip the real
 *  client (rightmost XFF nginx adds), not a spoofable left entry. */
function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown'
}

interface EstablishInput {
  sub: string
  groups: string[]
  displayName?: string
  email?: string
  refreshToken?: string
  accessExpiresAt?: number
}

@Controller('auth')
export class AuthController {
  private readonly cfg = loadAuthConfig(process.env)
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly sessions: SessionStore,
    private readonly userRoles: UserRoleRepo,
    private readonly userDirectory: UserDirectoryRepo,
    private readonly pmhId: PmhIdIdentity,
    private readonly oidcStates: OidcStateStore,
    private readonly loginThrottle: LoginThrottle,
    private readonly localLogin: LocalLoginUseCase,
  ) {}

  @Get('login')
  async login(
    @Res() res: Response,
    @Query('login_hint') loginHint?: string,
  ): Promise<void> {
    if (this.cfg.devAuth) {
      res.status(200).json({ mode: 'dev', hint: 'POST /auth/dev-login { sub, groups }' })
      return
    }
    if (!this.cfg.oidc) {
      res.status(501).json({ code: 'OidcNotProvisioned', message: 'Chưa cấu hình OIDC' })
      return
    }
    const { url, state, nonce, verifier } = await this.pmhId.authorizationUrl({ loginHint })
    this.oidcStates.put(state, { nonce, verifier })
    res.redirect(url)
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    // access_denied = the user has no group granted for this app (not a 500).
    const err = typeof req.query.error === 'string' ? req.query.error : undefined
    if (err) {
      res.redirect(`${this.cfg.webOrigin}/?auth_error=${encodeURIComponent(err)}`)
      return
    }
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    const saved = this.oidcStates.take(state)
    if (!saved || !this.cfg.oidc) {
      res.status(400).json({ code: 'BadOidcState', message: 'State không hợp lệ hoặc đã hết hạn' })
      return
    }
    const callbackUrl = new URL(this.cfg.oidc.redirectUri)
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') callbackUrl.searchParams.set(key, value)
    }
    const { user, tokens } = await this.pmhId.exchange(callbackUrl, saved.verifier, state, saved.nonce)
    // App-side group gate (2nd layer over PMH ID's own grant): someone who knows
    // the URL but isn't in an allowed group can't complete login. OFF when the
    // allow-list is empty (fail-open) — see auth.config QLHS_ALLOWED_GROUPS.
    if (!isGroupAllowed(user.groups, this.cfg.allowedGroups)) {
      this.logger.warn(`login denied (group): sub=${user.sub} groups=[${user.groups.join(',')}]`)
      res.redirect(`${this.cfg.webOrigin}/?auth_error=access_denied`)
      return
    }
    await this.establishSession(res, {
      sub: user.sub,
      groups: user.groups,
      displayName: user.displayName,
      email: user.email,
      refreshToken: tokens.refreshToken,
      accessExpiresAt: tokens.expiresAt,
    })
    res.redirect(this.cfg.webOrigin)
  }

  @Post('dev-login')
  async devLogin(
    @Body() body: { sub?: string; email?: string; roles?: string[] },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    if (!this.cfg.devAuth) {
      throw new UnauthorizedException({ code: 'DevAuthDisabled', message: 'Dev login đã tắt' })
    }
    const sub = body.sub?.trim() || 'dev-user'
    if (body.roles?.length) {
      const roles = body.roles.filter((r): r is Role => (ALL_ROLES as readonly string[]).includes(r))
      await this.userRoles.setRoles(sub, roles)
    }
    await this.establishSession(res, {
      sub,
      email: body.email,
      groups: [],
      displayName: body.email ?? sub,
    })
    return { ok: true }
  }

  // Break-glass local SA login (QLTS parity): the SPA branches client-side —
  // an email goes to PMH ID (SSO), a non-email username lands here. 5 attempts
  // per minute per IP: enough for a fat-fingered login, far too few to brute
  // force; the global throttler is only a DoS backstop.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('local-login')
  async localLoginRoute(
    @Body() body: { username?: string; password?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const ip = clientIp(req)
    // Gate the per-IP lockout on the same flag as the Nest throttler so a burst
    // of supertest calls from one loopback IP can't make other suites flaky; its
    // own e2e re-enables it. `throttleDisabled` is inert in production, so the
    // lockout is always live there even if the flag leaks into the prod env.
    const throttleOn = !throttleDisabled()
    // A locked IP is rejected WITHOUT checking the password, so brute-forcing
    // can't proceed even within a fresh rate-limit window.
    if (throttleOn && this.loginThrottle.isLocked(ip)) {
      throw this.lockedOut()
    }
    const identity = await this.localLogin.execute(body.username ?? '', body.password ?? '')
    if (!identity) {
      if (throttleOn && this.loginThrottle.fail(ip)) throw this.lockedOut()
      throw new UnauthorizedException({ code: 'InvalidCredentials', message: 'Tài khoản hoặc mật khẩu không đúng' })
    }
    if (throttleOn) this.loginThrottle.succeed(ip)
    await this.establishSession(res, { sub: identity.sub, groups: [], displayName: identity.username })
    return { ok: true }
  }

  private lockedOut(): HttpException {
    return new HttpException(
      { code: 'TooManyAttempts', message: 'Sai quá nhiều lần — tạm khóa đăng nhập. Thử lại sau ít phút.' },
      HttpStatus.TOO_MANY_REQUESTS,
    )
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: Request): CurrentUser {
    return req.currentUser as CurrentUser
  }

  @Post('active-role')
  @UseGuards(AuthGuard)
  setActiveRole(@Req() req: Request, @Body() body: { role?: string }): { activeRole: Role } {
    const user = req.currentUser as CurrentUser
    const role = body.role as Role | undefined
    if (!role || !user.roles.includes(role)) {
      throw new BadRequestException({ code: 'InvalidRole', message: 'Vai không hợp lệ' })
    }
    this.sessions.setActiveRole(req.sessionId as string, role)
    return { activeRole: role }
  }

  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): { ok: true; redirectTo: string } {
    const sid = req.cookies?.[this.cfg.cookieName] as string | undefined
    this.sessions.delete(sid)
    res.clearCookie(this.cfg.cookieName)
    return { ok: true, redirectTo: this.cfg.postLogoutRedirectUri }
  }

  /**
   * OIDC back-channel logout: the IdP POSTs a signed logout_token when the SSO
   * session ends. Verify it (JWKS + iss/aud + events claim) then kill the user's
   * local sessions. No-op when OIDC is not configured (dev).
   */
  @Post('backchannel-logout')
  @HttpCode(200)
  async backchannelLogout(@Body() body: { logout_token?: string }): Promise<{ ok: true }> {
    if (this.cfg.oidc) {
      try {
        const sub = await this.pmhId.verifyLogoutToken(body?.logout_token ?? '')
        this.sessions.deleteBySub(sub)
      } catch {
        throw new BadRequestException({ code: 'InvalidLogoutToken', message: 'logout_token không hợp lệ' })
      }
    }
    return { ok: true }
  }

  private async establishSession(res: Response, input: EstablishInput): Promise<void> {
    // Persist the user first so an Admin can see + assign roles even before the
    // user has any role.
    await this.userDirectory.upsertUser({
      sub: input.sub,
      fullName: input.displayName,
      email: input.email,
    })

    // Bootstrap the local SA by email (config).
    if (input.email && this.cfg.adminEmails.includes(input.email.toLowerCase())) {
      await this.userRoles.ensureRole(input.sub, ROLE.Admin)
    }

    const roles = effectiveRoles(await this.userRoles.rolesForSub(input.sub))
    const activeRole = resolveActiveRole(roles)

    const sid = this.sessions.create({
      sub: input.sub,
      groups: input.groups,
      roles,
      activeRole,
      // Never surface the raw PMH sub in the UI: fall back to email when the IdP
      // gave no display name (AD-7 keeps sub as the identity, email as display).
      displayName: input.displayName ?? input.email ?? input.sub,
      email: input.email,
      refreshToken: input.refreshToken,
      accessExpiresAt: input.accessExpiresAt,
    })
    res.cookie(this.cfg.cookieName, sid, {
      httpOnly: true,
      // Strict, not lax: the session cookie is never needed on a cross-site
      // request. This is safe because the OIDC state lives server-side (not in a
      // cookie that must survive the IdP round-trip), and web + api + id are all
      // under pmh.com.vn, so the callback redirect is same-site. A deep-link
      // opened from an email lands on the static SPA, which then fetches /api/me
      // same-site with the cookie attached — so those keep working too.
      sameSite: 'strict',
      secure: this.cfg.cookieSecure,
      path: '/',
    })
  }
}
