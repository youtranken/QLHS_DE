import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminDocTypes } from './AdminDocTypes'
import * as api from './api'
import type { AdminDocTypeGroup } from './api'

const getGroups = vi.spyOn(api, 'getAdminDocTypes')
const setActive = vi.spyOn(api, 'setDocTypeActive')
const del = vi.spyOn(api, 'deleteDocType')

function groups(): AdminDocTypeGroup[] {
  return [
    {
      flow: 'Payment',
      types: [
        { id: 'p1', value: 'Payment', active: true, usedBy: 3 },
        { id: 'p2', value: 'Payment request', active: true, usedBy: 0 },
        { id: 'p3', value: 'Advance request', active: false, usedBy: 0 },
      ],
    },
  ]
}

// Radix menus use pointer capture + scrollIntoView, neither of which jsdom implements.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  ;(Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false
  ;(Element.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}
  ;(Element.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {}
})

beforeEach(() => {
  setActive.mockResolvedValue({ id: 'x' })
  del.mockResolvedValue({ ok: true })
})

describe('AdminDocTypes', () => {
  it('shows each active type with its usage count', async () => {
    getGroups.mockResolvedValue(groups())
    render(<AdminDocTypes />)
    expect(await screen.findByRole('button', { name: 'Thao tác cho Payment' })).toBeInTheDocument()
    expect(screen.getByText('·3')).toBeInTheDocument()
    expect(screen.getAllByText('·0').length).toBe(1) // only the visible active unused one
  })

  it('hides inactive types until "show hidden" is ticked', async () => {
    getGroups.mockResolvedValue(groups())
    render(<AdminDocTypes />)
    await screen.findByRole('button', { name: 'Thao tác cho Payment' })
    expect(screen.queryByText('Advance request')).toBeNull()

    await userEvent.click(screen.getByLabelText('Hiện loại đã ẩn'))
    expect(await screen.findByText('Advance request')).toBeInTheDocument()
    expect(screen.getByText('ẩn')).toBeInTheDocument() // hidden pill
  })

  it('offers Delete only when the type is unused', async () => {
    getGroups.mockResolvedValue(groups())
    render(<AdminDocTypes />)
    await screen.findByRole('button', { name: 'Thao tác cho Payment' })

    // in-use type (usedBy=3): menu shows the blocked note, no Delete item
    await userEvent.click(screen.getByRole('button', { name: 'Thao tác cho Payment' }))
    expect(await screen.findByText(/Đang có 3 hồ sơ dùng/)).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Xoá' })).toBeNull()
    await userEvent.keyboard('{Escape}')

    // unused type (usedBy=0): Delete is offered
    await userEvent.click(screen.getByRole('button', { name: 'Thao tác cho Payment request' }))
    expect(await screen.findByRole('menuitem', { name: 'Xoá' })).toBeInTheDocument()
  })

  it('confirms then deletes an unused type', async () => {
    getGroups.mockResolvedValue(groups())
    render(<AdminDocTypes />)
    await screen.findByRole('button', { name: 'Thao tác cho Payment' })

    await userEvent.click(screen.getByRole('button', { name: 'Thao tác cho Payment request' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Xoá' }))

    // ConfirmModal — confirm with the danger button
    const confirm = await screen.findByRole('button', { name: 'Xoá' })
    await userEvent.click(confirm)
    await waitFor(() => expect(del).toHaveBeenCalledWith('p2'))
  })

  it('hides an active type via its menu', async () => {
    getGroups.mockResolvedValue(groups())
    render(<AdminDocTypes />)
    await screen.findByRole('button', { name: 'Thao tác cho Payment' })

    await userEvent.click(screen.getByRole('button', { name: 'Thao tác cho Payment' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Ẩn' }))
    await waitFor(() => expect(setActive).toHaveBeenCalledWith('p1', false))
  })

  it('reports a load failure instead of an empty catalog', async () => {
    getGroups.mockRejectedValue(new Error('offline'))
    render(<AdminDocTypes />)
    expect(await screen.findByText(/Không tải được danh mục/)).toBeInTheDocument()
  })
})
