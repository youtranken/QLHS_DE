import { test, expect } from '@playwright/test'
import { resetDb, soleTicketCode, contractNoByCode, eventsByCode } from './support/db'
import {
  loginAs,
  switchTo,
  createTicket,
  cardAction,
  confirmHandover,
  confirmModal,
  sendToAccounting,
  skipToCompleted,
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

  await cardAction(page, 'Gửi Accounting…') // primary button uses the short label
  await sendToAccounting(page, '26-CC-1-CT')
  await expectStatus(code!, 'Submitted to Accounting')

  await switchTo(page, 'dcc1-nam', ['DCC1'])
  await cardAction(page, 'Nhận về từ Accounting')
  await confirmHandover(page, 'Đã nhận về từ Accounting')
  await expectStatus(code!, 'Received from ACC')

  // Card primary button is "Trình BOP…" (opens a modal); the confirm modal title/button
  // keeps the "→" — submitToBop takes a required DCC1 comment (shown in the log).
  await cardAction(page, 'Trình BOP…')
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

// DCC2 "Skip to Completed": from Received by DCC2, fast-forward past ACC + BOP
// straight to Completed. Contract No left blank → stored N/A; every skipped step
// is written to the append-only log as the system ("Skip completed …").
test('Contract: "Skip to Completed" fast-forwards past ACC/BOP', async ({ page }) => {
  await loginAs(page, { sub: 'applicant-3', roles: [] })
  await page.goto('/')
  await createTicket(page, {
    documentType: 'Contract',
    contractor: 'Cty Skip',
    contractNo: 'HD-C-SKIP',
    amount: '3000000',
    budgetCode: 'BUD-C-9',
    description: 'Hồ sơ skip e2e',
  })

  await switchTo(page, 'dcc1-nam', ['DCC1'])
  await cardAction(page, 'Nhận')
  const code = await soleTicketCode()
  expect(code).toBeTruthy()
  await expectStatus(code!, 'Submitted to VP Andy')
  await cardAction(page, 'Chuyển cho DCC2 →')
  await expectStatus(code!, 'Submitted to DCC2')

  await switchTo(page, 'dcc2-hoa', ['DCC2'])
  await cardAction(page, 'Kiểm tra bản cứng')
  await confirmHandover(page)
  await expectStatus(code!, 'Received by DCC2')

  // Open the send-to-Accounting popup, tick "Skip to Completed", leave the number
  // blank, confirm the irreversible gate → the ticket jumps to Completed.
  await cardAction(page, 'Gửi Accounting…')
  await skipToCompleted(page)
  await expectStatus(code!, 'Completed')

  // Blank number → N/A, and the whole chain is on the append-only log as the system.
  expect(await contractNoByCode(code!)).toBe('N/A')
  const evs = await eventsByCode(code!)
  const systemSteps = evs.filter((e) => e.actorSub === 'system').map((e) => e.action)
  expect(systemSteps).toEqual([
    'sendToAccounting',
    'receiveFromAcc',
    'submitToBop',
    'bopApprove',
    'confirmReceivedByDcc2',
    'completeContract',
  ])
  // The skip note is recorded once, only on the final Completed step.
  const noted = evs.filter((e) => e.reason === 'Skip to Completed')
  expect(noted.map((e) => e.action)).toEqual(['completeContract'])
})
