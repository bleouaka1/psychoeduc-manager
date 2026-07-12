import { test, expect } from '@playwright/test'

const FONDATEUR_EMAIL = 'e2e-fondateur-fixture@psychoeduc-manager.local'
const FONDATEUR_PASSWORD = 'E2eFondateurFixture2026!'

test('le bénéficiaire voit la définition de son capital social et peut proposer une relation avec son formateur référent', async ({ page }) => {
  test.setTimeout(60_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', FONDATEUR_EMAIL)
  await page.fill('#password', FONDATEUR_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 45000 })

  await page.goto('/mon-espace')
  await expect(page).toHaveURL(/\/mon-espace\/[\w-]+$/, { timeout: 20000 })
  const dossierId = page.url().split('/mon-espace/')[1]
  await page.goto(`/mon-espace/${dossierId}/capital-social`)

  await expect(page.getByRole('heading', { name: 'Ton capital social' })).toBeVisible()
  await expect(page.getByText('Une relation devient capital social quand les deux personnes se le confirment')).toBeVisible()

  const boutonProposer = page.getByRole('button', { name: 'Proposer la relation' })
  if (await boutonProposer.count()) {
    await boutonProposer.click()
    await page.waitForLoadState('networkidle')
  }
  await expect(page.getByText('Demande envoyée')).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
