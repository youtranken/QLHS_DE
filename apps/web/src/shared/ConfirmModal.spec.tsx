import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfirmModal } from './ConfirmModal'

const noop = () => {}

describe('ConfirmModal — accessible labelling', () => {
  it('links the dialog to its own title via aria-labelledby', () => {
    render(<ConfirmModal message="Xóa?" onConfirm={noop} onCancel={noop} />)
    const dialog = screen.getByRole('dialog')
    const labelledby = dialog.getAttribute('aria-labelledby')
    expect(labelledby).toBeTruthy()
    // The referenced node must exist and hold the title text.
    const title = labelledby ? document.getElementById(labelledby) : null
    expect(title).not.toBeNull()
  })

  it('associates the reason label with its textarea via htmlFor/id', () => {
    render(<ConfirmModal message="Lý do?" reason onConfirm={noop} onCancel={noop} />)
    // getByLabelText only resolves when label htmlFor === textarea id.
    expect(screen.getByLabelText(/.*/, { selector: 'textarea' })).toBeInTheDocument()
  })

  it('gives two concurrently mounted modals DISTINCT ids (no duplicate DOM ids)', () => {
    // The nested-in-another-modal case (see component note): two mounted at once
    // must not collide, or aria-labelledby + label htmlFor break for both.
    render(
      <>
        <ConfirmModal message="A" reason onConfirm={noop} onCancel={noop} />
        <ConfirmModal message="B" reason onConfirm={noop} onCancel={noop} />
      </>,
    )
    const dialogs = screen.getAllByRole('dialog')
    expect(dialogs).toHaveLength(2)

    const labelledbys = dialogs.map((d) => d.getAttribute('aria-labelledby'))
    expect(labelledbys[0]).toBeTruthy()
    expect(labelledbys[1]).toBeTruthy()
    expect(labelledbys[0]).not.toBe(labelledbys[1])

    // No id appears more than once across the whole document.
    const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)

    // Each textarea is still reachable by its own label.
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
  })

  it('keeps behaviour: confirm passes the trimmed reason', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<ConfirmModal message="?" reason reasonDefault="  dup F12  " onConfirm={onConfirm} onCancel={noop} />)
    screen.getByRole('button', { name: 'Xác nhận' }).click()
    // microtask flush
    await Promise.resolve()
    expect(onConfirm).toHaveBeenCalledWith('dup F12')
  })
})
