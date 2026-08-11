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

/** Drive the Applicant create-ticket modal end to end. Document Type / Project Team
 *  / Payment Term are the shared custom Select (a button that opens a portaled
 *  role=listbox) — Document Type is picked by value; the Admin-seeded lists take
 *  their first real option. */
export async function createTicket(page: Page, f: TicketFields): Promise<void> {
  await page.getByRole('button', { name: 'Tạo hồ sơ mới' }).click()
  const modal = page.locator('form.modal')
  await expect(modal).toBeVisible()

  await selectOption(page, fieldOf(modal, 'Document Type'), f.documentType)
  await fieldOf(modal, 'Contractor').locator('input').fill(f.contractor)
  // Contract-flow types lock the Applicant's Contract No to N/A (DCC2 assigns it
  // later) — the input is disabled, so only fill it for the editable flows.
  const contractFlow = ['Contract', 'VO', 'Annex', 'Budget'].includes(f.documentType)
  if (!contractFlow) await fieldOf(modal, 'Contract No').locator('input').fill(f.contractNo)
  await modal.locator('.amtrow input').fill(f.amount)
  await fieldOf(modal, 'Budget code').locator('input').fill(f.budgetCode)
  await fieldOf(modal, 'Subject').getByRole('textbox').fill(f.description)
  await pickFirstOption(page, fieldOf(modal, 'Project/Team'))
  await pickFirstOption(page, fieldOf(modal, 'Payment Term'))

  await modal.getByRole('button', { name: 'Nộp hồ sơ' }).click()
  await expect(modal).toBeHidden()
}

/** Open a board card's ⋯ menu and click one legal action by its label. The board
 *  live-refetches after every action (SSE), which both collapses the <details> menu
 *  and briefly re-renders each action button as `disabled={busy}`. A force-click
 *  ignores that and silently no-ops on the busy button (or lands on a detaching
 *  node), so the transition never fires yet the click doesn't throw. Instead we
 *  gate on the button being visible AND enabled, then dispatch the click event
 *  directly to the current node (bypasses the sibling-pill hit-test, still fires
 *  the React onClick). Re-queried every toPass iteration, so a mid-flight re-render
 *  just retries. */
export async function cardAction(page: Page, label: string): Promise<void> {
  const card = page.locator('.tcard').first()
  const button = card.getByRole('button', { name: label })
  await expect(async () => {
    if (!(await button.isVisible())) {
      await card.locator('summary.dots').click()
    }
    await expect(button).toBeVisible()
    await expect(button).toBeEnabled()
    await button.dispatchEvent('click')
  }).toPass({ timeout: 15_000 })
}

/** Switch identity mid-journey: drop the old session, mint the new one, reload.
 *  Guards the post-switch board-fetch race — a stray 401 (board fetched a beat
 *  before the new cookie settles) can leave the board stuck empty, so wait for the
 *  columns to render and reload once if the first paint came up without them. */
export async function switchTo(page: Page, sub: string, roles: string[]): Promise<void> {
  await logout(page)
  await loginAs(page, { sub, roles })
  await page.goto('/')
  await expect(async () => {
    if ((await page.locator('.col').count()) === 0) await page.reload()
    await expect(page.locator('.col').first()).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 15_000 })
}

/** HandoverModal: the date defaults to today, so just confirm. */
export async function confirmHandover(page: Page, confirmLabel = 'Xác nhận'): Promise<void> {
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

/** Complete a Contract: no scan path anymore — just approve the danger confirm gate
 *  (DCC2 scans out-of-band; completing closes the file + emails the Applicant). */
export async function completeContract(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Hoàn tất & đóng hồ sơ' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/** ConfirmModal (consequence gate / reason gate): fill the reason if required, confirm. */
export async function confirmModal(page: Page, confirmLabel: string, reason?: string): Promise<void> {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // The reason field is a textarea with a dynamic useId() — target it by role, not id.
  if (reason !== undefined) await dialog.getByRole('textbox').fill(reason)
  await dialog.getByRole('button', { name: confirmLabel }).click()
  await expect(dialog).toBeHidden()
}

function fieldOf(modal: Locator, label: string): Locator {
  return modal.locator('.field', { hasText: label })
}

/** Open a custom Select (button + portaled role=listbox) and click one option by
 *  its exact accessible name. The listbox is portaled to <body>, so the option is
 *  matched at page scope, not inside the field. */
async function selectOption(page: Page, field: Locator, name: string): Promise<void> {
  await field.getByRole('button').first().click()
  await page.getByRole('option', { name, exact: true }).click()
}

/** Open a custom Select and pick its first real option (Admin-seeded list — the
 *  placeholder is button-only text, never a listbox option). */
async function pickFirstOption(page: Page, field: Locator): Promise<void> {
  await field.getByRole('button').first().click()
  await page.getByRole('option').first().click()
}
