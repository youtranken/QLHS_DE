import { test, expect } from '@playwright/test'
import { resetDb, soleTicketCode } from './support/db'
import {
  loginAs,
  switchTo,
  createTicket,
  cardAction,
  confirmModal,
  expectStatus,
} from './support/app'

test.beforeEach(async () => {
  await resetDb()
})

// Golden journey #3 — Payment hitting a Return: Pool → Andy → DCC3 handover →
// DCC3 spots a missing/wrong hardcopy AT RECEIPT and bounces it back with a
// reason → DCC1 Returns to the Applicant. (DCC3 has no push-back after receiving.)
test('Payment: DCC3 missing-paper at receipt → DCC1 returns to the Applicant', async ({ page }) => {
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
  // Opens the handover modal, then reports missing paper (with a reason) instead
  // of confirming — the ticket stays put and bounces to DCC1's reconcile lane.
  await cardAction(page, 'Đã nhận bản cứng')
  await page.getByRole('button', { name: 'Thiếu giấy, trả về DCC1' }).click()
  const confirm = page.getByRole('dialog').last()
  await confirm.getByRole('textbox').fill('Bản cứng sai — thiếu trang 3')
  await confirm.getByRole('button', { name: 'Trả về DCC1' }).click()
  await expectStatus(code!, 'Submitted to DCC3') // status unchanged (reconcile-flagged)

  // DCC1 clears the reconcile lane by Returning the ticket to the Applicant.
  await switchTo(page, 'dcc1-nam', ['DCC1'])
  await cardAction(page, 'Trả lại Applicant (Return)')
  await confirmModal(page, 'Trả lại', 'Bản cứng sai — trả lại để bổ sung')
  await expectStatus(code!, 'Returned')
})
