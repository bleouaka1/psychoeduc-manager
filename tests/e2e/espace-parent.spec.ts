import { test, expect } from '@playwright/test'

const PARENT_EMAIL = 'e2e-invitation-parent-fixture@psychoeduc-manager.local'
const PARENT_PASSWORD = 'E2eInvitationParent2026!'

test('un parent connecté atterrit sur /espace-parent et voit présences + tendance de progression, jamais un score chiffré', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', PARENT_EMAIL)
  await page.fill('#password', PARENT_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/espace-parent', { timeout: 30000 })

  await expect(page.getByText('Assignation')).toBeVisible()
  await expect(page.getByText('Tendance de progression')).toBeVisible()
  await expect(page.getByText('Progresse', { exact: true })).toBeVisible()
  await expect(page.getByText('Présences (30 derniers jours)')).toBeVisible()
  await expect(page.getByText('Présent', { exact: true }).first()).toBeVisible()

  // Non négociable §4.3 : jamais un score IGA chiffré brut visible sur cette page.
  await expect(page.getByText(/\b(40|65)\/100\b/)).toHaveCount(0)

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
