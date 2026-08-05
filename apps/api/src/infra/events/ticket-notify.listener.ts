import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { Client } from 'pg'
import { Subject, type Observable } from 'rxjs'

export interface TicketChange {
  id: string
  flow: string
  status: string
  /** For per-viewer SSE filtering only — stripped before relay to the browser. */
  applicantSub: string
}

const CHANNEL = 'qlhs_ticket'
const RECONNECT_MS = 2000

/**
 * 2.1 — one dedicated Postgres connection LISTENing for the ticket-change NOTIFY
 * the DB trigger fires, fanned out to every SSE subscriber through an RxJS
 * Subject. A single connection for the whole process (not one per browser); the
 * SSE controller multicasts from here.
 *
 * Prisma cannot surface async LISTEN notifications, so this uses a raw `pg`
 * client. It reconnects on drop — a silent dead listener would freeze every
 * board back into staleness with no error.
 */
@Injectable()
export class TicketNotifyListener implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(TicketNotifyListener.name)
  private readonly subject = new Subject<TicketChange>()
  private client: Client | null = null
  private stopped = false

  /** Hot stream of ticket changes; completes on shutdown. */
  get changes(): Observable<TicketChange> {
    return this.subject.asObservable()
  }

  /** True once the dedicated LISTEN connection is live — used by the health
   *  surface and by the SSE e2e to avoid racing the first insert. */
  get isListening(): boolean {
    return this.client !== null
  }

  onModuleInit(): void {
    // Off in tests by default (like the crons): a live LISTEN socket per test app
    // is noise; the SSE e2e turns it on to exercise the real chain.
    if (process.env.QLHS_DISABLE_CRON === '1' && process.env.QLHS_ENABLE_SSE !== '1') return
    void this.connect()
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true
    this.subject.complete()
    await this.client?.end().catch(() => undefined)
  }

  private async connect(): Promise<void> {
    if (this.stopped) return
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    client.on('error', (e) => this.onDrop(client, e))
    client.on('notification', (msg) => this.emit(msg.payload))
    try {
      await client.connect()
      await client.query(`LISTEN ${CHANNEL}`)
      this.client = client
      this.log.log(`LISTEN ${CHANNEL} established`)
    } catch (e) {
      this.onDrop(client, e)
    }
  }

  private emit(payload: string | undefined): void {
    if (!payload) return
    try {
      const c = JSON.parse(payload) as TicketChange
      this.subject.next(c)
    } catch {
      this.log.warn(`unparseable ${CHANNEL} payload: ${payload}`)
    }
  }

  private onDrop(client: Client, e: unknown): void {
    if (this.stopped || client !== this.client) {
      // A drop during connect (client not yet adopted) or after shutdown.
      void client.end().catch(() => undefined)
    }
    this.client = null
    this.log.warn(`${CHANNEL} listener dropped, reconnecting: ${String(e)}`)
    if (!this.stopped) setTimeout(() => void this.connect(), RECONNECT_MS)
  }
}
