import { test, expect } from '@playwright/test'
import { resetDb, soleTicketCode } from './support/db'
import {
  loginAs,
  switchTo,
  createTicket,
  cardAction,
  confirmHandover,
  confirmModal,
  expectStatus,
} from './support/app'

test.beforeEach(async () => {
  await resetDb()
})

// Golden journey #3 — Payment hitting a Return: Pool → Andy → DCC3 handover →
// DCC3 spots a wrong hardcopy → pushes back → DCC1 Returns to the Applicant.
test('Payment: DCC3 push-back → DCC1 returns to the Applicant', async ({ page }) => {
  await loginAs(page, { sub: 'applicant-3', roles: [] })
  await page.goto('/')
  await createTicket(page, {
    documentType: 'Payment',
    contractor: 'Cty PAY',
    contractNo: 'HD-P-001',
    amount: '3000000',
    budgetCode: 'BUD-P-1',
    description: 'Hồ sơ thanh toán e2e',
  })

  await switchTo(page, 'dcc1-nam', ['DCC1'])
  await cardAction(page, 'Bốc & xử lý')
  await cardAction(page, 'Trình Sếp')
  await expect(page.getByRole('status').filter({ hasText: 'Đã sinh mã' })).toBeVisible() // mint committed
  const code = await soleTicketCode()
  expect(code).toBeTruthy()

  await cardAction(page, 'Chuyển cho DCC3 →')
  await expectStatus(code!, 'Submitted to DCC3')

  await switchTo(page, 'dcc3-lan', ['DCC3'])
  await cardAction(page, 'Đã nhận bản cứng')
  await confirmHandover(page)
  await expectStatus(code!, 'Received by DCC3')

  // Wrong hardcopy → DCC3 pushes back to DCC1 (a note, not an edge).
  await cardAction(page, 'Đẩy ngược DCC1 (bản cứng sai)')
  await confirmModal(page, 'Đẩy ngược')

  // DCC1 clears the reconcile lane by Returning the ticket to the Applicant.
  await switchTo(page, 'dcc1-nam', ['DCC1'])
  await cardAction(page, 'Trả lại Applicant (Return)')
  await confirmModal(page, 'Trả lại', 'Bản cứng sai — trả lại để bổ sung')
  await expectStatus(code!, 'Returned')
})
