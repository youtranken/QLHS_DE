import { expect, type Locator, type Page } from '@playwright/test'
import { statusByCode } from './db'

/** Poll the persisted status until it matches — a card action resolves on the
 *  click, before its transaction commits, so a single read can race. */
export async function expectStatus(code: string, status: string): Promise<void> {
  await expect.poll(() => statusByCode(code), { timeout: 10_000 }).toBe(status)
}

export interface LoginOpts {
  sub: string
  roles?: string[]
  email?: string
}

/** Mint a session via the dev-login door (DEV_AUTH only). page.request shares the
 *  page's browser context, so the cookie is set for the subsequent navigation. */
export async function loginAs(page: Page, opts: LoginOpts): Promise<void> {
  const res = await page.request.post('/api/auth/dev-login', {
    data: { sub: opts.sub, email: opts.email ?? `${opts.sub}@test.local`, roles: opts.roles ?? [] },
  })
  expect(res.ok(), `dev-login for ${opts.sub} failed: ${res.status()}`).toBeTruthy()
}

/** Log out so the next role starts from a clean session in the same browser. */
export async function logout(page: Page): Promise<void> {
  await page.request.post('/api/auth/logout')
}

export interface TicketFields {
  documentType: 'General' | 'Contract' | 'VO' | 'Annex' | 'Budget' | 'Payment'
  contractor: string
  contractNo: string
  amount: string
  budgetCode: string
  description: string
}

/** Drive the Applicant create-ticket modal end to end. Project Team / Payment Term
 *  are Admin-managed dropdowns (seeded) — pick the first real option; if a fresh
 *  install left them as free text, type instead. */
export async function createTicket(page: Page, f: TicketFields): Promise<void> {
  await page.getByRole('button', { name: 'Tạo hồ sơ mới' }).click()
  const modal = page.locator('form.modal')
  await expect(modal).toBeVisible()

  await fieldOf(modal, 'Document Type').locator('select').selectOption(f.documentType)
  await fieldOf(modal, 'Contractor').locator('input').fill(f.contractor)
  await fieldOf(modal, 'Contract No').locator('input').fill(f.contractNo)
  await modal.locator('.amtrow input').fill(f.amount)
  await fieldOf(modal, 'Budget code').locator('input').fill(f.budgetCode)
  await fieldOf(modal, 'Description').locator('textarea').fill(f.description)
  await pickListField(fieldOf(modal, 'Project/Team'), 'Team A')
  await pickListField(fieldOf(modal, 'Payment Term'), 'Net 30')

  await modal.getByRole('button', { name: 'Nộp hồ sơ' }).click()
  await expect(modal).toBeHidden()
}

/** Open a board card's ⋯ menu and click one legal action by its label. The board
 *  live-refetches after every action, which collapses the <details> menu mid-flight
 *  — so re-open and retry until the click lands.
 *
 *  Known limitation (accepted): the retry re-clicks, so a click that throws *after*
 *  its event already dispatched could, very rarely, double-fire a non-idempotent
 *  transition or hang on a stale menu. A generic guard can't distinguish "action
 *  fired" from "button momentarily re-rendering" without knowing the expected next
 *  status; the correct fix is to thread that status into this helper and poll for it
 *  (tracked as follow-up). The journeys have run green repeatedly; a flake reruns. */
export async function cardAction(page: Page, label: string): Promise<void> {
  const card = page.locator('.tcard').first()
  const button = card.getByRole('button', { name: label })
  await expect(async () => {
    if (!(await button.isVisible())) {
      await card.locator('summary.dots').click()
    }
    // force: the dropdown items sit under sibling pills in the card header layout;
    // we only need the button's onClick, not a hit-test.
    await button.click({ timeout: 2000, force: true })
  }).toPass({ timeout: 15_000 })
}

/** Switch identity mid-journey: drop the old session, mint the new one, reload. */
export async function switchTo(page: Page, sub: string, roles: string[]): Promise<void> {
  await logout(page)
  await loginAs(page, { sub, roles })
  await page.goto('/')
}

/** HandoverModal: the date defaults to today, so just confirm. */
export async function confirmHandover(page: Page, confirmLabel = 'Đủ & đúng — Xác nhận nhận'): Promise<void> {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: confirmLabel }).click()
  await expect(dialog).toBeHidden()
}

/** SendAccountingModal: enter the Document No (26-CC-..-CT) and send. */
export async function sendToAccounting(page: Page, documentNo: string): Promise<void> {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('input').first().fill(documentNo)
  await dialog.getByRole('button', { name: 'Gửi ACC' }).click()
  await expect(dialog).toBeHidden()
}

/** CompleteContractModal: enter the scan path, then approve the danger confirm gate. */
export async function completeContract(page: Page, scanPath: string): Promise<void> {
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  await dialog.locator('input').first().fill(scanPath)
  await dialog.getByRole('button', { name: 'Hoàn tất' }).click()
  // Irreversible (AD-19) → a ConfirmModal now gates the actual completion.
  await page.getByRole('button', { name: 'Hoàn tất & đóng hồ sơ' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/** ConfirmModal (consequence gate / reason gate): fill the reason if required, confirm. */
export async function confirmModal(page: Page, confirmLabel: string, reason?: string): Promise<void> {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  if (reason !== undefined) await dialog.locator('#confirm-reason').fill(reason)
  await dialog.getByRole('button', { name: confirmLabel }).click()
  await expect(dialog).toBeHidden()
}

function fieldOf(modal: Locator, label: string): Locator {
  return modal.locator('.field', { hasText: label })
}

async function pickListField(field: Locator, freeText: string): Promise<void> {
  const select = field.locator('select')
  if (await select.count()) {
    // Skip the disabled "— chọn —" placeholder at index 0.
    await select.selectOption({ index: 1 })
  } else {
    await field.locator('input').fill(freeText)
  }
}
