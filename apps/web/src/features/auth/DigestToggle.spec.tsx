import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DigestToggle } from './DigestToggle'
import * as client from '../../shared/api-client'

const get = vi.spyOn(client, 'apiGet')
const post = vi.spyOn(client, 'apiPost')

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('DigestToggle', () => {
  it('shows the current setting as a switch', async () => {
    get.mockResolvedValue({ enabled: true })
    render(<DigestToggle />)
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked())
  })

  it('turns the digest off and tells the server', async () => {
    get.mockResolvedValue({ enabled: true })
    post.mockResolvedValue({ enabled: false })
    render(<DigestToggle />)
    await waitFor(() => expect(screen.getByRole('switch')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('switch'))
    expect(post).toHaveBeenCalledWith('/me/digest', { enabled: false })
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked())
  })

  it('rolls back the switch when the server refuses — never claim a change that did not happen', async () => {
    get.mockResolvedValue({ enabled: true })
    post.mockRejectedValue(new Error('boom'))
    render(<DigestToggle />)
    await waitFor(() => expect(screen.getByRole('switch')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked())
  })

  it('renders nothing if the preference cannot be read', async () => {
    get.mockRejectedValue(new Error('offline'))
    const { container } = render(<DigestToggle />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
