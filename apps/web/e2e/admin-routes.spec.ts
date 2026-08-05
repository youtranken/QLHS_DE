import { test, expect } from '@playwright/test'
import { loginAs } from './support/app'
import { resetDb } from './support/db'

// Mỗi mục sidebar admin có URL riêng (/admin/<section>): deep-link, F5 và
// back/forward đều giữ đúng pane. URL sạch (History API) — nginx/Vite fallback
// mọi path lạ về index.html nên F5/deep-link không 404.
test('Admin sections are deep-linkable via /admin/<section>', async ({ page }) => {
  await resetDb()
  await loginAs(page, { sub: 'admin-e2e', roles: ['Admin'] })

  // Deep-link thẳng vào Người dùng & Vai
  await page.goto('/admin/roles')
  await expect(page.getByRole('heading', { name: 'Người dùng & Vai' })).toBeVisible()

  // Click nav → URL đổi theo
  await page.getByRole('button', { name: /Ngưỡng SLA/ }).click()
  await expect(page.getByRole('heading', { name: 'Ngưỡng SLA' })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/sla$/)

  // Back của browser quay lại mục trước
  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/roles$/)
  await expect(page.getByRole('heading', { name: 'Người dùng & Vai' })).toBeVisible()

  // F5 giữ nguyên mục đang xem
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Người dùng & Vai' })).toBeVisible()

  // Path lạ rơi về Tổng quan, không màn trắng
  await page.goto('/admin/nonsense')
  await expect(page.getByRole('heading', { name: 'Tổng quan quản trị' })).toBeVisible()
})
