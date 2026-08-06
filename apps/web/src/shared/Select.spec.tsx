import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { Select } from './Select'

const OPTS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
]

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
