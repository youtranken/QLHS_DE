import { afterEach, describe, expect, it } from 'vitest'
import { applyVp, getVpName, kindMessage, setVpName, statusVi, t } from './t'

describe('t()', () => {
  it('returns the raw VI string for a plain key', () => {
    expect(t('common.time.justNow')).toBe('vừa xong')
  })
  it('interpolates {param} placeholders', () => {
    expect(t('common.time.minutes', { n: 5 })).toBe('5 phút')
    expect(t('common.time.daysAgo', { n: 2 })).toBe('2 ngày trước')
  })
  it('leaves missing params visible instead of swallowing them', () => {
    expect(t('common.time.minutes', {})).toBe('{n} phút')
  })
})

describe('statusVi (AD-13 seam)', () => {
  it('maps canonical EN → VI', () => {
    expect(statusVi('Submitted')).toBe('Chờ tiếp nhận (Pool)')
    expect(statusVi('Return-fixing')).toBe('Đang sửa & nộp lại')
  })
  it('passes unknown statuses through unchanged', () => {
    expect(statusVi('Some Future Status')).toBe('Some Future Status')
  })
})

describe('kindMessage', () => {
  it('maps kinds and passes unknown through', () => {
    expect(kindMessage('Returned')).toBe('Hồ sơ bị trả lại — cần bổ sung')
    expect(kindMessage('MysteryKind')).toBe('MysteryKind')
  })
})

describe('VP name substitution (single source)', () => {
  afterEach(() => setVpName('Andy')) // reset the module-level name between tests

  it('defaults to Andy — labels are byte-identical when unset', () => {
    expect(getVpName()).toBe('Andy')
    expect(statusVi('Submitted to VP Andy')).toBe('Chờ Andy ký')
    expect(applyVp('Submitted to VP Andy')).toBe('Submitted to VP Andy')
  })

  it('rewrites the name in the canonical EN status (raw seam) once set', () => {
    setVpName('Bình')
    expect(applyVp('Submitted to VP Andy')).toBe('Submitted to VP Bình')
  })

  it('rewrites the name in the VI gloss via statusVi', () => {
    setVpName('Khang')
    expect(statusVi('Submitted to VP Andy')).toBe('Chờ Khang ký')
  })

  it('rewrites {vp} placeholders and the Andy word inside t()', () => {
    setVpName('Minh')
    expect(t('tickets.routeRail.waiting.andy')).toBe('Chờ VP Minh duyệt')
  })

  it('ignores a blank name (keeps the previous one)', () => {
    setVpName('Long')
    setVpName('   ')
    expect(getVpName()).toBe('Long')
  })

  it('does NOT rewrite the VP name inside interpolated params (only static text)', () => {
    setVpName('Bình')
    // A person literally named "…Andy" must keep their own name — the template
    // "Chào {who} 👋 …" has no VP token, so the param passes through untouched.
    const greeting = t('assistant.welcome', { who: 'Sếp Andy' })
    expect(greeting).toContain('Sếp Andy')
    expect(greeting).not.toContain('Bình')
  })

  it('inserts a name containing "$" literally (no String.replace $-substitution)', () => {
    setVpName('A$&B')
    expect(applyVp('Submitted to VP Andy')).toBe('Submitted to VP A$&B')
  })
})
