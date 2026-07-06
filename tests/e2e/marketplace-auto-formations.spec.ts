import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

test('une formation nouvellement créée apparaît automatiquement, une seule fois, sur la Marketplace', async ({ page }) => {
  test.setTimeout(90_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/', { timeout: 45000 })

  await page.goto('/solo/formations')
  const titre = `Formation AutoMarket E2E ${Date.now()}`
  await page.fill('input[name="titre"]', titre)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('div.py-4').filter({ hasText: titre })).toBeVisible({ timeout: 15000 })

  // la formation vient d'être créée en "brouillon" (jamais publiée manuellement) mais doit
  // déjà avoir une offre marketplace liée, auto-créée, accessible via sa page détail —
  // /solo/marketplace (grille de découverte) exclut délibérément la propre organisation
  // du visiteur, donc on vérifie via l'id de la formation plutôt que par la grille
  // (dédoublonnage déjà vérifié séparément par test_marketplace_auto_formations_logique.sql).
  const carteCreee = page.locator('div.py-4').filter({ hasText: titre })
  const hrefModifier = await carteCreee.getByRole('link', { name: 'Modifier' }).getAttribute('href')
  const formationId = new URL(hrefModifier ?? '', 'http://localhost:3000').searchParams.get('edit')
  await page.goto(`/solo/marketplace/formation/${formationId}`)
  await expect(page.getByText(titre)).toBeVisible({ timeout: 15000 })

  // nettoyage : suppression de la formation (aucune inscription dessus), cascade sur l'offre liée
  await page.goto('/solo/formations')
  const carte = page.locator('div.py-4').filter({ hasText: titre })
  await carte.getByRole('button', { name: 'Supprimer' }).click()
  await page.click('button:has-text("Supprimer définitivement")')
  await page.waitForLoadState('networkidle')

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
