import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('./api', () => ({ ask: vi.fn() }))
vi.mock('../../shared/route', () => ({ openTicketDetail: vi.fn() }))

import { ROLE } from '@qlhs/contracts'
import { ask, type AssistantReply } from './api'
import { openTicketDetail } from '../../shared/route'
import { AssistantPanel } from './AssistantPanel'

const reply = (over: Partial<AssistantReply> = {}): AssistantReply => ({
  answer: {
    blocks: [{ type: 'ticketList', rows: [{ code: 'G-2026-0001', flow: 'General', status: 'Submitted', priority: 'normal' }] }],
  },
  suggestions: [{ label: 'Hồ sơ của tôi', text: 'hồ sơ của tôi' }],
  ...over,
})

beforeEach(() => {
  vi.mocked(ask).mockResolvedValue(reply())
})

async function openPanel() {
  await userEvent.click(screen.getByRole('button', { name: 'Trợ lý QLHS' }))
}

describe('AssistantPanel', () => {
  it('mở panel, gõ câu hỏi, hiện kết quả có mã hồ sơ', async () => {
    render(<AssistantPanel />)
    await openPanel()
    await userEvent.type(screen.getByLabelText('Câu hỏi'), 'hồ sơ của tôi')
    await userEvent.click(screen.getByRole('button', { name: 'Gửi' }))
    expect(ask).toHaveBeenCalledWith('hồ sơ của tôi')
    expect(await screen.findByRole('button', { name: 'G-2026-0001' })).toBeInTheDocument()
  })

  it('bấm chip gửi luôn câu gợi ý', async () => {
    render(<AssistantPanel />)
    await openPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ của tôi' }))
    expect(ask).toHaveBeenCalledWith('hồ sơ của tôi')
  })

  it('render block thống kê (stats) từ server', async () => {
    vi.mocked(ask).mockResolvedValue({
      answer: { blocks: [{ type: 'stats', title: 'Tổng quan hệ thống', items: [{ label: 'Đang chạy', value: 5 }] }] },
      suggestions: [],
    })
    render(<AssistantPanel />)
    await openPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ của tôi' }))
    expect(await screen.findByText('Đang chạy')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('nút "Xoá đoạn chat" làm mới về trạng thái đầu', async () => {
    render(<AssistantPanel />)
    await openPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ của tôi' }))
    await screen.findByRole('button', { name: 'G-2026-0001' })
    await userEvent.click(screen.getByRole('button', { name: 'Xoá đoạn chat' }))
    expect(screen.queryByRole('button', { name: 'G-2026-0001' })).not.toBeInTheDocument()
  })

  it('chip khởi tạo theo vai — Admin thấy "Tổng quan hệ thống"', async () => {
    render(<AssistantPanel activeRole={ROLE.Admin} userName="Sếp Andy" />)
    await openPanel()
    expect(screen.getByRole('button', { name: 'Tổng quan hệ thống' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hồ sơ của tôi' })).not.toBeInTheDocument()
  })

  it('chip khởi tạo theo vai — DCC thấy "Việc của tôi"', async () => {
    render(<AssistantPanel activeRole={ROLE.Dcc2} userName="Lan" />)
    await openPanel()
    expect(screen.getByRole('button', { name: 'Việc của tôi' })).toBeInTheDocument()
  })

  it('hồ sơ đã đóng → pill "đã đóng", KHÔNG bịa "trong hạn" (grounding)', async () => {
    vi.mocked(ask).mockResolvedValue({
      answer: {
        blocks: [
          { type: 'ticketDetail', code: 'G-2026-0001', flow: 'General', status: 'Completed', priority: 'normal', overdueDays: 0, paused: false, isClosed: true, documentType: null },
        ],
      },
      suggestions: [],
    })
    render(<AssistantPanel />)
    await openPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ của tôi' }))
    expect(await screen.findByText('đã đóng')).toBeInTheDocument()
    expect(screen.queryByText('trong hạn')).not.toBeInTheDocument()
  })

  it('bấm mã hồ sơ trong kết quả → mở chi tiết', async () => {
    render(<AssistantPanel />)
    await openPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ của tôi' }))
    await userEvent.click(await screen.findByRole('button', { name: 'G-2026-0001' }))
    expect(openTicketDetail).toHaveBeenCalledWith('G-2026-0001')
  })
})
