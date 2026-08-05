import { describe, expect, it } from 'vitest'
import { kindMessage, statusVi, t } from './t'

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
