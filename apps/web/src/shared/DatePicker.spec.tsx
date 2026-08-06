import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { DatePicker } from './DatePicker'

function focusedCell(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.dp-cell[data-focus="1"]')
  if (!el) throw new Error('no roving-focus cell')
  return el
}

describe('DatePicker — keyboard operability (a11y H1/H2)', () => {
  it('opens from the trigger with ArrowDown and picks a day with arrows + Enter', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-08-15" onChange={onChange} ariaLabel="Ngày" />)

    const trigger = screen.getByLabelText('Ngày')
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    // Popover open, focus lands on the selected day (15th).
    expect(focusedCell().textContent).toBe('15')

    fireEvent.keyDown(focusedCell(), { key: 'ArrowRight' })
    expect(focusedCell().textContent).toBe('16')
    fireEvent.keyDown(focusedCell(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('2026-08-16')
  })

  it('ArrowUp/Down move by a week', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-08-15" onChange={onChange} ariaLabel="Ngày" />)
    const trigger = screen.getByLabelText('Ngày')
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(focusedCell(), { key: 'ArrowDown' })
    expect(focusedCell().textContent).toBe('22')
  })

  it('Escape closes only the calendar and does NOT bubble to a parent modal handler', () => {
    const onChange = vi.fn()
    const parentEsc = vi.fn()
    render(
      <div onKeyDown={(e) => e.key === 'Escape' && parentEsc()}>
        <DatePicker value="2026-08-15" onChange={onChange} ariaLabel="Ngày" />
      </div>,
    )
    const trigger = screen.getByLabelText('Ngày')
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(document.querySelector('.dp-pop')).toBeTruthy()

    fireEvent.keyDown(focusedCell(), { key: 'Escape' })
    expect(document.querySelector('.dp-pop')).toBeFalsy() // calendar closed
    expect(parentEsc).not.toHaveBeenCalled() // parent modal NOT torn down
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders the clear control as a real sibling button, not nested in the trigger', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-08-15" onChange={onChange} ariaLabel="Ngày" clearable />)
    const clear = screen.getByRole('button', { name: /bỏ chọn|clear/i })
    // Not a descendant of the trigger button (interactive-in-interactive is invalid).
    expect(clear.closest('.dp-trigger')).toBeNull()
    fireEvent.click(clear)
    expect(onChange).toHaveBeenCalledWith('')
  })
})
