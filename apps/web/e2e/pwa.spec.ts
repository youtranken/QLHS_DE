import { test, expect } from '@playwright/test'
test('pwa assets are served', async ({ page }) => {
  const m = await page.request.get('/manifest.webmanifest')
  expect(m.ok()).toBeTruthy()
  const json = await m.json()
  expect(json.display).toBe('standalone')
  const i = await page.request.get('/icon.svg')
  expect(i.ok()).toBeTruthy()
  expect((await i.text())).toContain('<svg')
})
