import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { Select } from './Select'

const OPTS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
]
// > SEARCH_MIN (8) → dropdown mọc ô lọc.
const MANY = Array.from({ length: 12 }, (_, i) => ({ value: `v${i}`, label: `Item ${i}` }))

describe('Select — screen-reader active-option wiring (a11y H3)', () => {
  it('exposes aria-controls + aria-activedescendant that point at the active option', () => {
    render(<Select value="b" onChange={vi.fn()} options={OPTS} ariaLabel="Chọn" />)
    const trigger = screen.getByLabelText('Chọn')
    fireEvent.click(trigger)

    const listId = trigger.getAttribute('aria-controls')
    expect(listId).toBeTruthy()
    const active = trigger.getAttribute('aria-activedescendant')
    expect(active).toBeTruthy()
    // The active descendant is a real option element inside the listbox, and it is
    // the currently-selected one (Beta).
    const activeEl = document.getElementById(active!)
    expect(activeEl?.getAttribute('role')).toBe('option')
    expect(activeEl?.getAttribute('aria-selected')).toBe('true')
    expect(document.getElementById(listId!)?.getAttribute('role')).toBe('listbox')
  })
})

describe('Select — ô lọc gõ-để-tìm cho list dài (>8)', () => {
  it('list ngắn (≤8) → KHÔNG có ô lọc', () => {
    render(<Select value="a" onChange={vi.fn()} options={OPTS} ariaLabel="S" />)
    fireEvent.click(screen.getByLabelText('S'))
    expect(screen.queryByPlaceholderText('Tìm kiếm…')).toBeNull()
  })

  it('list dài (>8) → mọc ô lọc; gõ để lọc còn mục khớp', () => {
    render(<Select value="v0" onChange={vi.fn()} options={MANY} ariaLabel="S" />)
    fireEvent.click(screen.getByLabelText('S'))
    const box = screen.getByPlaceholderText('Tìm kiếm…')
    expect(box).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Item 3' })).toBeInTheDocument()
    fireEvent.change(box, { target: { value: 'item 3' } })
    expect(screen.getByRole('option', { name: 'Item 3' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Item 5' })).toBeNull()
  })

  it('không khớp → hiện thông báo "Không khớp"', () => {
    render(<Select value="v0" onChange={vi.fn()} options={MANY} ariaLabel="S" />)
    fireEvent.click(screen.getByLabelText('S'))
    fireEvent.change(screen.getByPlaceholderText('Tìm kiếm…'), { target: { value: 'zzz' } })
    expect(screen.getByText('— Không khớp —')).toBeInTheDocument()
  })

  it('bấm 1 mục đã lọc → onChange đúng value + đóng', () => {
    const onChange = vi.fn()
    render(<Select value="v0" onChange={onChange} options={MANY} ariaLabel="S" />)
    fireEvent.click(screen.getByLabelText('S'))
    fireEvent.change(screen.getByPlaceholderText('Tìm kiếm…'), { target: { value: 'item 5' } })
    fireEvent.click(screen.getByRole('option', { name: 'Item 5' }))
    expect(onChange).toHaveBeenCalledWith('v5')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('mục đang chọn có aria-selected (dấu ✓)', () => {
    render(<Select value="b" onChange={vi.fn()} options={OPTS} ariaLabel="S" />)
    fireEvent.click(screen.getByLabelText('S'))
    expect(screen.getByRole('option', { name: 'Beta' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('option', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('false')
  })
})
