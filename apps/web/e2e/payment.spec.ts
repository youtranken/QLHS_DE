import { test, expect } from '@playwright/test'
import { resetDb, soleTicketCode } from './support/db'
import {
  loginAs,
  switchTo,
  createTicket,
  cardAction,
  expectStatus,
} from './support/app'

test.beforeEach(async () => {
  await resetDb()
})

// Golden journey #3 — Payment reconcile: Pool → Andy → DCC3 handover → DCC3 spots
// a missing/wrong hardcopy AT RECEIPT and bounces it back with a reason → DCC1
// supplements and re-hands over. (DCC1 could also Return here — covered in the API
// e2e; DCC3 has no push-back after receiving.)
test('Payment: DCC3 missing-paper at receipt → DCC1 supplements and re-hands over', async ({ page }) => {
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
  await cardAction(page, 'Nhận') // pick + confirm merged: mints code → Submitted to VP Andy
  await expect(page.getByRole('status').filter({ hasText: 'Đã sinh mã' })).toBeVisible() // mint committed
  const code = await soleTicketCode()
  expect(code).toBeTruthy()

  await cardAction(page, 'Chuyển cho DCC3 →')
  await expectStatus(code!, 'Submitted to DCC3')

  await switchTo(page, 'dcc3-lan', ['DCC3'])
  // Opens the handover modal, then reports missing paper (with a reason) instead
  // of confirming — the ticket stays put and bounces to DCC1's reconcile lane.
  await cardAction(page, 'Kiểm tra bản cứng')
  await page.getByRole('button', { name: 'Trả về DCC1', exact: true }).click()
  const confirm = page.getByRole('dialog').last()
  await confirm.getByRole('textbox').fill('Bản cứng sai — thiếu trang 3')
  await confirm.getByRole('button', { name: 'Trả về DCC1' }).click()
  await expectStatus(code!, 'Submitted to DCC3') // status unchanged (reconcile-flagged)

  // DCC1 sees it in the "Chờ kiểm tra lại" lane (with DCC3's reason). Here DCC1
  // supplements and re-hands over; DCC1 could also Return to the Applicant instead
  // (the ⋯ "Trả lại Applicant" action — exercised in payment-handover.e2e-spec.ts).
  await switchTo(page, 'dcc1-nam', ['DCC1'])
  await cardAction(page, 'Đã bổ sung, gửi lại →')
  await expectStatus(code!, 'Submitted to DCC3') // reconcile cleared, back to DCC3
})
