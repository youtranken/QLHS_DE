import { Controller, MessageEvent, Sse, UseGuards } from '@nestjs/common'
import { filter, interval, map, merge, type Observable } from 'rxjs'
import { canSeeAllTicketChanges } from '../../domain/auth/roles'
import { AuthGuard } from '../auth/auth.guard'
import { GetCurrentUser, type CurrentUser } from '../auth/current-user'
import { TicketNotifyListener } from '../../infra/events/ticket-notify.listener'

// Comment-style keepalive so nginx (default 60s read timeout) never severs an
// idle stream; the browser ignores 'ping'.
const HEARTBEAT_MS = 25_000

/**
 * 2.1 — the real-time firehose. One authenticated SSE stream per browser (cookie
 * session, AuthGuard). Each ticket change becomes a small `ticket` event the SPA
 * treats as "refetch what you're showing" — the server stays the single place
 * that decides who may see what: staff get every change, a plain Applicant only
 * their own tickets (AD-16), and the relayed event carries only id/flow/status.
 */
@Controller('events')
export class EventsController {
  constructor(private readonly listener: TicketNotifyListener) {}

  @UseGuards(AuthGuard)
  @Sse('stream')
  stream(@GetCurrentUser() user: CurrentUser): Observable<MessageEvent> {
    const seeAll = canSeeAllTicketChanges(user.roles)
    const changes = this.listener.changes.pipe(
      filter((c) => seeAll || c.applicantSub === user.sub),
      // Strip applicantSub — the browser only needs the refetch signal, and the
      // server has already enforced who may receive it.
      map((c): MessageEvent => ({ type: 'ticket', data: { id: c.id, flow: c.flow, status: c.status } })),
    )
    const ping = interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: {} })))
    return merge(changes, ping)
  }
}
