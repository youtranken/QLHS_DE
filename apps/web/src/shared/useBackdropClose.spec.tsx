import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useBackdropClose } from './useBackdropClose'

function Modal({ onClose }: { onClose: () => void }) {
  const backdrop = useBackdropClose(onClose)
  return (
    <div data-testid="overlay" {...backdrop}>
      <div data-testid="dialog">
        <input data-testid="field" />
      </div>
    </div>
  )
}

describe('useBackdropClose', () => {
  it('closes when the press and release both land on the backdrop', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Modal onClose={onClose} />)
    const overlay = getByTestId('overlay')
    fireEvent.mouseDown(overlay)
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT close when the drag starts inside the dialog and ends on the backdrop', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Modal onClose={onClose} />)
    // Press inside a field (text-selection drag), release on the overlay → the
    // click lands on the overlay, but the press did not.
    fireEvent.mouseDown(getByTestId('field'))
    fireEvent.click(getByTestId('overlay'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not close on a click inside the dialog', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Modal onClose={onClose} />)
    fireEvent.mouseDown(getByTestId('field'))
    fireEvent.click(getByTestId('field'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
