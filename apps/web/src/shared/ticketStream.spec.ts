import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { subscribeTicketChanges } from './ticketStream'

// jsdom has no EventSource; a tiny fake lets us drive 'ticket' events and count
// how many connections the singleton opens.
class FakeEventSource {
  static instances: FakeEventSource[] = []
  listeners = new Map<string, (e: MessageEvent) => void>()
  onmessage: ((e: MessageEvent) => void) | null = null
  closed = false
  constructor(public url: string) {
    FakeEventSource.instances.push(this)
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners.set(type, cb)
  }
  close() {
    this.closed = true
  }
  emitTicket() {
    this.listeners.get('ticket')?.(new MessageEvent('ticket', { data: '{}' }))
  }
}

beforeEach(() => {
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource)
})
afterEach(() => vi.unstubAllGlobals())

describe('ticketStream — one shared connection, ref-counted', () => {
  it('opens a single EventSource for many subscribers', () => {
    const un1 = subscribeTicketChanges(() => {})
    const un2 = subscribeTicketChanges(() => {})
    expect(FakeEventSource.instances).toHaveLength(1)
    un1()
    un2()
  })

  it('notifies every subscriber on a ticket event', () => {
    const a = vi.fn()
    const b = vi.fn()
    const un1 = subscribeTicketChanges(a)
    const un2 = subscribeTicketChanges(b)
    FakeEventSource.instances[0]!.emitTicket()
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
    un1()
    un2()
  })

  it('closes the connection when the last subscriber leaves, reopens on the next', () => {
    const un1 = subscribeTicketChanges(() => {})
    un1()
    expect(FakeEventSource.instances[0]!.closed).toBe(true)

    const un2 = subscribeTicketChanges(() => {})
    expect(FakeEventSource.instances).toHaveLength(2)
    un2()
  })

  it('stops notifying an unsubscribed listener', () => {
    const a = vi.fn()
    const un1 = subscribeTicketChanges(a)
    const un2 = subscribeTicketChanges(() => {}) // keep the connection open
    un1()
    FakeEventSource.instances[0]!.emitTicket()
    expect(a).not.toHaveBeenCalled()
    un2()
  })
})
