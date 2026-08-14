import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { DocTypePicker } from './DocTypePicker'

const GROUPS = [
  { flow: 'General', types: ['General'] },
  { flow: 'Contract', types: ['Contract', 'VO', 'Annex', 'Budget'] },
  { flow: 'Payment', types: ['Payment'] },
]

const menu = () => document.querySelector('.dtpk-menu')
const openWith = (props: Partial<Parameters<typeof DocTypePicker>[0]> = {}) => {
  const onChange = props.onChange ?? vi.fn()
  render(
    <DocTypePicker value="General" onChange={onChange} groups={GROUPS} ariaLabel="Document Type" {...props} />,
  )
  fireEvent.click(screen.getByLabelText('Document Type'))
  return onChange
}

describe('DocTypePicker — 2 cột "mở sách"', () => {
  it('mở ra: hiện cột LUỒNG, CHƯA bung cột loại', () => {
    openWith()
    expect(screen.getByRole('tab', { name: /General/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Contract/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Payment/ })).toBeInTheDocument()
    expect(menu()?.classList.contains('expanded')).toBe(false)
  })

  it('bấm luồng NHIỀU loại (Contract) → bung cột loại', () => {
    openWith()
    fireEvent.click(screen.getByRole('tab', { name: /Contract/ }))
    expect(menu()?.classList.contains('expanded')).toBe(true)
    expect(screen.getByRole('option', { name: 'VO' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Budget' })).toBeInTheDocument()
  })

  it('bấm luồng CHỈ 1 loại (Payment) → chọn thẳng, KHÔNG bung + đóng', () => {
    const onChange = openWith()
    fireEvent.click(screen.getByRole('tab', { name: /Payment/ }))
    expect(onChange).toHaveBeenCalledWith('Payment')
    expect(screen.queryByRole('tab', { name: /Payment/ })).toBeNull() // đã đóng
  })

  it('bấm một loại ở cột phải → onChange đúng + đóng', () => {
    const onChange = openWith()
    fireEvent.click(screen.getByRole('tab', { name: /Contract/ }))
    fireEvent.click(screen.getByRole('option', { name: 'VO' }))
    expect(onChange).toHaveBeenCalledWith('VO')
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('loại đang chọn có aria-selected', () => {
    openWith({ value: 'VO' })
    fireEvent.click(screen.getByRole('tab', { name: /Contract/ }))
    expect(screen.getByRole('option', { name: 'VO' }).getAttribute('aria-selected')).toBe('true')
  })

  it('bàn phím: →/Enter bung luồng, ↓ đổi loại, Enter chốt', () => {
    const onChange = vi.fn()
    render(<DocTypePicker value="Contract" onChange={onChange} groups={GROUPS} ariaLabel="Document Type" />)
    const trigger = screen.getByLabelText('Document Type')
    fireEvent.click(trigger) // mở; activeFlow = Contract (luồng của value)
    fireEvent.keyDown(trigger, { key: 'ArrowRight' }) // bung cột loại Contract
    expect(menu()?.classList.contains('expanded')).toBe(true)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // Contract → VO
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('VO')
  })

  it('Escape → đóng', () => {
    openWith()
    fireEvent.keyDown(screen.getByLabelText('Document Type'), { key: 'Escape' })
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('disabled → không mở', () => {
    render(<DocTypePicker value="General" onChange={vi.fn()} groups={GROUPS} ariaLabel="Document Type" disabled />)
    fireEvent.click(screen.getByLabelText('Document Type'))
    expect(screen.queryByRole('tablist')).toBeNull()
  })
})
