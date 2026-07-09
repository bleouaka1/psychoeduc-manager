import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

test('un compte Solo peut créer une évaluation IGA-J complète et voir le résultat (score, dimensions fortes/faibles)', async ({ page }) => {
  test.setTimeout(120_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/')

  const nom = 'E2E'
  const prenoms = `IgaEval${Date.now()}`
  await page.goto('/solo/beneficiaires')
  await page.fill('input[name="nom"]', nom)
  await page.fill('input[name="prenoms"]', prenoms)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  const lien = page.getByRole('link', { name: `${nom} ${prenoms}` })
  await expect(lien).toBeVisible()
  await lien.click()
  await expect(page).toHaveURL(/\/solo\/beneficiaires\/[\w-]+$/, { timeout: 20000 })

  await page.click('text=Nouvelle évaluation IGA')
  await expect(page).toHaveURL(/\/evaluations\/nouvelle/, { timeout: 20000 })

  // Sans date de naissance renseignée, le référentiel suggéré par défaut est IGA-J.
  await expect(page.getByRole('link', { name: /IGA-J/ })).toHaveClass(/bg-accent-gold/)

  // Note tous les critères au maximum (4) pour vérifier un score global proche de 100.
  const radiosMax = page.locator('input[type="radio"][value="4"]')
  const total = await radiosMax.count()
  expect(total).toBeGreaterThan(20) // IGA-J a 26 critères
  for (let i = 0; i < total; i++) {
    await radiosMax.nth(i).check()
  }

  await page.fill('textarea[name="commentaire"]', 'Commentaire E2E — évaluation notée au maximum')
  await page.click('button:has-text("Enregistrer l\'évaluation")')

  await expect(page).toHaveURL(/\/evaluations\/[\w-]+$/, { timeout: 20000 })
  await expect(page.getByText('Résultat de l\'évaluation')).toBeVisible()
  await expect(page.getByText('Autonomie élevée')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Dimensions les plus fortes')).toBeVisible()
  await expect(page.getByText('Dimensions à travailler en priorité')).toBeVisible()

  // Tout noté au maximum -> le cadran IGA affiche 100 (Math.round de la valeur, texte brut dans le SVG).
  await expect(page.getByText('100', { exact: true })).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
