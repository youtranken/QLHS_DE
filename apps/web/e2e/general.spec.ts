import { test, expect } from '@playwright/test'
import { resetDb, soleTicketCode, ticketCount } from './support/db'
import { loginAs, logout, createTicket, cardAction, expectStatus } from './support/app'

test.beforeEach(async () => {
  await resetDb()
})

// Golden journey #1 — General flow, the full loop: an Applicant submits, DCC1
// takes it from the Pool and mints a code, then records Andy's approval to close.
test('General: create → pool pick → confirm → Andy complete', async ({ page }) => {
  await loginAs(page, { sub: 'applicant-1', roles: [] }) // no roles → Applicant baseline
  await page.goto('/')
  await createTicket(page, {
    documentType: 'General',
    contractor: 'Cty ABC',
    contractNo: 'HD-G-001',
    amount: '1000000',
    budgetCode: 'BUD-G-1',
    description: 'Hồ sơ tổng hợp e2e',
  })
  expect(await ticketCount()).toBe(1)

  // DCC1 takes it from the Pool — "Nhận" mints the code AND advances to Submitted
  // to VP Andy in one step (pick + confirm merged).
  await logout(page)
  await loginAs(page, { sub: 'dcc1-nam', roles: ['DCC1'] })
  await page.goto('/')
  await cardAction(page, 'Nhận')
  await expect(page.getByRole('status').filter({ hasText: 'Đã sinh mã' })).toBeVisible()

  const code = await soleTicketCode()
  expect(code).toBeTruthy()
  await expectStatus(code!, 'Submitted to VP Andy')

  // DCC1 records Andy's approval → Completed (irreversible → confirm dialog).
  await cardAction(page, 'VP duyệt → hoàn tất')
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'VP duyệt → hoàn tất' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã thực hiện' })).toBeVisible()

  await expectStatus(code!, 'Completed')
})
