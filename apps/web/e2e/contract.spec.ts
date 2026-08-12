import { test, expect } from '@playwright/test'
import { resetDb, soleTicketCode } from './support/db'
import {
  loginAs,
  switchTo,
  createTicket,
  cardAction,
  confirmHandover,
  confirmModal,
  sendToAccounting,
  completeContract,
  expectStatus,
} from './support/app'

test.beforeEach(async () => {
  await resetDb()
})

// Golden journey #2 — Contract, every station: Pool → Andy → DCC2 handover → ACC
// → BOP → DCC2 hardcopy → Completed, crossing DCC1↔DCC2 four times.
test('Contract: full line through every station to Completed', async ({ page }) => {
  await loginAs(page, { sub: 'applicant-2', roles: [] })
  await page.goto('/')
  await createTicket(page, {
    documentType: 'Contract',
    contractor: 'Cty XYZ',
    contractNo: 'HD-C-001',
    amount: '5000000',
    budgetCode: 'BUD-C-1',
    description: 'Hồ sơ hợp đồng e2e',
  })

  await switchTo(page, 'dcc1-nam', ['DCC1'])
  await cardAction(page, 'Nhận') // pick + confirm merged: mints code → Submitted to VP Andy
  await expect(page.getByRole('status').filter({ hasText: 'Đã sinh mã' })).toBeVisible() // mint committed
  const code = await soleTicketCode()
  expect(code).toBeTruthy()
  await expectStatus(code!, 'Submitted to VP Andy')

  await cardAction(page, 'Chuyển cho DCC2 →')
  await expectStatus(code!, 'Submitted to DCC2')

  await switchTo(page, 'dcc2-hoa', ['DCC2'])
  await cardAction(page, 'Kiểm tra bản cứng')
  await confirmHandover(page)
  await expectStatus(code!, 'Received by DCC2')

  await cardAction(page, 'Gửi Kế toán…') // primary button uses the short label
  await sendToAccounting(page, '26-CC-1-CT')
  await expectStatus(code!, 'Submitted to Accounting')

  await switchTo(page, 'dcc1-nam', ['DCC1'])
  await cardAction(page, 'Nhận về từ ACC')
  await confirmHandover(page, 'Đã nhận về từ ACC')
  await expectStatus(code!, 'Received from ACC')

  await cardAction(page, 'Trình BOP →')
  // SubmitToBop now takes a required DCC1 comment (shown in the handover log).
  await confirmModal(page, 'Trình BOP →', 'Trình BOP sau khi ACC duyệt')
  await expectStatus(code!, 'Submitted to BOP')

  await cardAction(page, 'BOP duyệt → bàn giao DCC2')
  await expectStatus(code!, 'Submitted to DCC2 (Hardcopy)')

  await switchTo(page, 'dcc2-hoa', ['DCC2'])
  await cardAction(page, 'Kiểm tra bản cứng')
  await confirmHandover(page)
  await expectStatus(code!, 'Hardcopy')

  await cardAction(page, 'Hoàn tất') // primary button uses the short label
  await completeContract(page)
  await expectStatus(code!, 'Completed')
})
