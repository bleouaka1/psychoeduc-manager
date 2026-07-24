import { test, expect } from '@playwright/test'

const DIRECTEUR_EMAIL = 'e2e-structure-directeur-fixture@psychoeduc-manager.local'
const DIRECTEUR_PASSWORD = 'E2eStructureDirecteur2026!'

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', DIRECTEUR_EMAIL)
  await page.fill('#password', DIRECTEUR_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/dashboard', { timeout: 30000 })
}

test('un Directeur ajoute une pièce à la checklist d\'un dossier et fait progresser son statut jusqu\'à Validé', async ({ page }) => {
  test.setTimeout(120_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)
  await page.goto('/dossiers')

  const ligneBeneficiaire = page.locator('tr').filter({ hasText: 'Fixture' }).filter({ hasText: 'Assignation' })
  await expect(ligneBeneficiaire).toBeVisible()
  await ligneBeneficiaire.getByRole('link', { name: 'Fixture' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/dossiers\/[\w-]+$/)

  // 1. Ajouter une pièce timestampée pour ne pas collisionner avec un run précédent.
  const typePiece = `Pièce E2E ${Date.now()}`
  await page.fill('input[name="type_document"]', typePiece)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  const lignePiece = page.locator('li').filter({ hasText: typePiece })
  await expect(lignePiece).toBeVisible()
  // Nouvelle pièce = statut "Manquant" actif par défaut.
  await expect(lignePiece.getByRole('button', { name: 'Manquant' })).toHaveClass(/bg-danger/)

  // 2. Faire progresser jusqu'à "Validé".
  await lignePiece.getByRole('button', { name: 'Reçu' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('li').filter({ hasText: typePiece }).getByRole('button', { name: 'Reçu' })).toHaveClass(/bg-accent-gold/)

  await page.locator('li').filter({ hasText: typePiece }).getByRole('button', { name: 'Validé' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('li').filter({ hasText: typePiece }).getByRole('button', { name: 'Validé' })).toHaveClass(/bg-accent-teal/)

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
