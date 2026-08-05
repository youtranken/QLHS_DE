import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpsHealthScheduler } from './ops-health.scheduler'
import type { MetricsRepo, MetricsSnapshot } from '../prisma/admin/metrics.repo'

const snap = (over: Partial<MetricsSnapshot> = {}): MetricsSnapshot => ({
  tickets: [],
  mailPending: 0,
  mailFailed: 0,
  digestPending: 0,
  digestFailed: 0,
  ...over,
})

const withRepo = (s: MetricsSnapshot): OpsHealthScheduler =>
  new OpsHealthScheduler({ collect: () => Promise.resolve(s) } as unknown as MetricsRepo)

describe('OpsHealthScheduler.check', () => {
  const prev = { ...process.env }
  beforeEach(() => {
    process.env.QLHS_MAIL_BACKLOG_WARN = '20'
    process.env.QLHS_MAIL_BACKLOG_CRITICAL = '100'
  })
  afterEach(() => {
    process.env = { ...prev }
    vi.restoreAllMocks()
  })

  it('stays quiet when the queue is drained', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await withRepo(snap()).check()).toBe('ok')
    expect(warn).not.toHaveBeenCalled()
    expect(err).not.toHaveBeenCalled()
  })

  it('warns (not errors) when pending is merely building', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await withRepo(snap({ mailPending: 25 })).check()).toBe('warn')
  })

  it('errors when a mail was actually dropped (failed row)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await withRepo(snap({ mailFailed: 1 })).check()).toBe('critical')
  })

  it('a blank threshold env falls back to the default, not 0 (no empty-queue spam)', async () => {
    process.env.QLHS_MAIL_BACKLOG_WARN = ''
    process.env.QLHS_MAIL_BACKLOG_CRITICAL = ''
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await withRepo(snap()).check()).toBe('ok')
    expect(warn).not.toHaveBeenCalled()
    expect(err).not.toHaveBeenCalled()
  })

  it('a non-numeric threshold env falls back to the default, not NaN (alert stays live)', async () => {
    process.env.QLHS_MAIL_BACKLOG_WARN = 'twenty'
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // With NaN the pending alert would be silently off; the fallback (20) still warns.
    expect(await withRepo(snap({ mailPending: 50 })).check()).toBe('warn')
  })

  it('scheduled() is a no-op while crons are disabled', async () => {
    process.env.QLHS_DISABLE_CRON = '1'
    const repo = { collect: vi.fn() } as unknown as MetricsRepo
    expect(await new OpsHealthScheduler(repo).scheduled()).toBe('ok')
    expect((repo as unknown as { collect: ReturnType<typeof vi.fn> }).collect).not.toHaveBeenCalled()
  })
})
