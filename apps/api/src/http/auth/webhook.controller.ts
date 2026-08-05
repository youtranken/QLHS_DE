import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common'
import type { Request } from 'express'
import { loadAuthConfig } from '../../config/auth.config'
import { SessionStore } from '../../infra/session/session.store'
import { UserDirectoryRepo } from '../../infra/prisma/users/user-directory.repo'
import { ProcessedWebhookEventRepo } from '../../infra/prisma/webhook/processed-event.repo'
import { verifyWebhookHmac } from '../../infra/pmh-id/webhook-hmac'
import { isKickEvent, parseWebhookEvent, WEBHOOK_STATUS_BY_EVENT } from '../../domain/auth/webhook-event'

/**
 * PMH ID offboarding webhook — a second revocation channel beyond OIDC
 * back-channel logout (which only fires on SSO logout). HMAC-SHA256 over the RAW
 * body is verified BEFORE anything else; then user.locked/deleted/password_changed
 * kill every local session for that sub immediately. Idempotent by event_id.
 * Returns 2xx fast so PMH ID doesn't retry a good delivery. Public (no cookie):
 * the HMAC is the auth. Requires app-wide `rawBody: true` (see main.ts).
 */
@Controller('webhooks')
export class WebhookController {
  private readonly cfg = loadAuthConfig(process.env)
  private readonly logger = new Logger(WebhookController.name)

  constructor(
    private readonly sessions: SessionStore,
    private readonly users: UserDirectoryRepo,
    private readonly processed: ProcessedWebhookEventRepo,
  ) {
    // Warn ONCE at boot, not per request: the endpoint is public, so a per-request
    // error log would let anyone flood the log by POSTing to a mis-configured box.
    if (!this.cfg.webhookSecret) {
      this.logger.error('PMH_WEBHOOK_SECRET chưa cấu hình — mọi webhook sẽ bị từ chối (offboarding không chạy).')
    }
  }

  @Post('pmh-id')
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-pmh-signature') signature: string | undefined,
  ): Promise<{ ok: true }> {
    const rawBody = req.rawBody
    if (!rawBody || !verifyWebhookHmac(rawBody, signature, this.cfg.webhookSecret)) {
      throw new UnauthorizedException({ code: 'WebhookSignatureInvalid', message: 'Chữ ký webhook không hợp lệ' })
    }

    // Signature valid but payload malformed → 400, NOT 500: a 5xx makes PMH ID
    // retry the same broken payload with backoff forever.
    const event = parseWebhookEvent(rawBody.toString('utf8'))
    if (!event) {
      throw new BadRequestException({ code: 'WebhookPayloadInvalid', message: 'Payload webhook không hợp lệ' })
    }

    // Idempotent by event_id: check BEFORE, mark AFTER. A crash mid-way re-runs the
    // handler on retry — every action below (deleteBySub/setStatus) is idempotent.
    if (event.eventId && (await this.processed.isProcessed(event.eventId))) {
      return { ok: true }
    }

    if (isKickEvent(event.type)) {
      const killed = this.sessions.deleteBySub(event.userId)
      const status = WEBHOOK_STATUS_BY_EVENT[event.type]
      if (status) await this.users.setStatus(event.userId, status)
      this.logger.warn(
        `webhook ${event.type}: killed ${killed} session(s) sub=${event.userId}${status ? ` status=${status}` : ''}`,
      )
    } else if (event.type === 'user.groups_changed') {
      // QLHS doesn't persist groups (they gate only at login); force re-login so
      // the group gate re-runs against the new membership.
      const killed = this.sessions.deleteBySub(event.userId)
      this.logger.warn(`webhook groups_changed: killed ${killed} session(s) sub=${event.userId}`)
    } else {
      this.logger.log(`webhook event bỏ qua: ${event.type}`)
    }

    if (event.eventId) await this.processed.markProcessed(event.eventId)
    return { ok: true }
  }
}
