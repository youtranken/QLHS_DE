import { describe, expect, it } from 'vitest'
import { splitActions, primaryLabel } from './primaryAction'
import { PAUSE_EVENT, RESUME_EVENT } from './slaPauseActions'
import type { LegalAction } from './api'

const act = (over: Partial<LegalAction> & { event: string }): LegalAction => ({
  label: over.event,
  toStatus: 'x',
  reversible: false,
  reasonRequired: false,
  ...over,
})

describe('splitActions — nút chính vs ⋯', () => {
  it('promotes a safe forward action to the primary button', () => {
    const { primary, menu } = splitActions([act({ event: 'handoverToDcc2' })])
    expect(primary).toHaveLength(1)
    expect(menu).toHaveLength(0)
  })

  it('keeps reason-gated actions (Return/Reopen) in the ⋯ menu', () => {
    const { primary, menu } = splitActions([
      act({ event: 'sendBack', reasonRequired: true }),
      act({ event: 'reopen', reasonRequired: true }),
    ])
    expect(primary).toHaveLength(0)
    expect(menu).toHaveLength(2)
  })

  it('promotes submitToBop to the primary button despite its required comment', () => {
    const { primary, menu } = splitActions([
      act({ event: 'submitToBop', reasonRequired: true, toStatus: 'Submitted to BOP' }),
      act({ event: 'sendBack', reasonRequired: true, toStatus: 'Returned' }),
    ])
    expect(primary.map((a) => a.event)).toEqual(['submitToBop'])
    expect(menu.map((a) => a.event)).toEqual(['sendBack'])
  })

  it('promotes andyRequireBop to the primary button despite its required comment (General)', () => {
    const { primary, menu } = splitActions([
      act({ event: 'andyApproveComplete' }),
      act({ event: 'andyRequireBop', reasonRequired: true, toStatus: 'Submitted to BOP' }),
      act({ event: 'sendBack', reasonRequired: true, toStatus: 'Returned' }),
    ])
    expect(primary.map((a) => a.event)).toEqual(['andyApproveComplete', 'andyRequireBop'])
    expect(menu.map((a) => a.event)).toEqual(['sendBack'])
  })

  it('keeps SLA clock controls in the ⋯ menu', () => {
    const { primary, menu } = splitActions([
      act({ event: PAUSE_EVENT, reasonRequired: true }),
      act({ event: RESUME_EVENT }),
    ])
    expect(primary).toHaveLength(0)
    expect(menu).toHaveLength(2)
  })

  it('keeps a destructive backward action (toStatus Returned/Cancelled) in ⋯ even if not reasonRequired', () => {
    const { primary, menu } = splitActions([
      act({ event: 'cancel', toStatus: 'Cancelled' }),
      act({ event: 'someBack', toStatus: 'Returned' }),
    ])
    expect(primary).toHaveLength(0)
    expect(menu).toHaveLength(2)
  })

  it('gives General "Trình Sếp" BOTH forwards as buttons, order preserved', () => {
    const { primary } = splitActions([
      act({ event: 'andyApproveComplete' }),
      act({ event: 'andyRequireBop' }),
      act({ event: 'sendBack', reasonRequired: true }),
    ])
    expect(primary.map((a) => a.event)).toEqual(['andyApproveComplete', 'andyRequireBop'])
  })
})

describe('primaryLabel — nhãn nút ngắn', () => {
  it('shortens the long/renamed forward labels', () => {
    expect(primaryLabel(act({ event: '__pick', label: 'Bốc & xử lý' }))).toBe('Nhận')
    expect(primaryLabel(act({ event: 'andyApproveComplete', label: 'Sếp duyệt → hoàn tất' }))).toBe('Sếp duyệt → hoàn tất')
    expect(primaryLabel(act({ event: 'andyRequireBop', label: 'Sếp đã duyệt → trình BOP' }))).toBe('Trình BOP')
    expect(primaryLabel(act({ event: 'sendToAccounting', label: 'Nhập Contract No & gửi Accounting' }))).toBe('Gửi Kế toán…')
    expect(primaryLabel(act({ event: 'completeContract', label: 'Hoàn tất & đóng hồ sơ' }))).toBe('Hoàn tất')
    expect(primaryLabel(act({ event: 'submitToBop', label: 'Trình BOP →' }))).toBe('Trình BOP')
  })

  it('falls back to the server label for everything else', () => {
    expect(primaryLabel(act({ event: 'handoverToDcc2', label: 'Chuyển cho DCC2 →' }))).toBe('Chuyển cho DCC2 →')
  })
})
