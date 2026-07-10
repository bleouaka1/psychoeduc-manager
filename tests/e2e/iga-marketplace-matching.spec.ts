import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

test('un compte Solo peut déclarer une spécialité IGA sur son profil et la retrouve persistée', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/solo')

  await page.goto('/solo/profil')
  const caseAutonomieEconomique = page.locator('input[name="specialites_dimensions_iga"][value="autonomie_economique"]')
  await caseAutonomieEconomique.check()
  await page.click('button:has-text("Enregistrer")')
  await page.waitForLoadState('networkidle')

  await page.reload()
  await expect(page.locator('input[name="specialites_dimensions_iga"][value="autonomie_economique"]')).toBeChecked()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('le résultat d\'évaluation IGA propose toujours "Contacter le Fondateur", même sans praticien spécialisé disponible', async ({ page }) => {
  test.setTimeout(60_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/solo')

  const nom = 'E2E'
  const prenoms = `IgaMatching${Date.now()}`
  await page.goto('/solo/beneficiaires')
  await page.fill('input[name="nom"]', nom)
  await page.fill('input[name="prenoms"]', prenoms)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  await page.getByRole('link', { name: `${nom} ${prenoms}` }).click()
  await expect(page).toHaveURL(/\/solo\/beneficiaires\/[\w-]+$/, { timeout: 20000 })

  await page.click('text=Nouvelle évaluation IGA')
  await expect(page).toHaveURL(/\/evaluations\/nouvelle/, { timeout: 20000 })

  // Note tous les critères au minimum (0) pour garantir des dimensions faibles.
  const radiosMin = page.locator('input[type="radio"][value="0"]')
  const total = await radiosMin.count()
  for (let i = 0; i < total; i++) {
    await radiosMin.nth(i).check()
  }
  await page.click('button:has-text("Enregistrer l\'évaluation")')
  await expect(page).toHaveURL(/\/evaluations\/[\w-]+$/, { timeout: 20000 })

  await expect(page.getByText('Mise en relation')).toBeVisible()
  await expect(page.getByRole('button', { name: /Contacter/ }).last()).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
