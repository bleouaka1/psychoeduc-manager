import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

test('une formation nouvellement créée apparaît automatiquement, une seule fois, sur la Marketplace', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/')

  await page.goto('/solo/formations')
  const titre = `Formation AutoMarket E2E ${Date.now()}`
  await page.fill('input[name="titre"]', titre)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('div.py-4').filter({ hasText: titre })).toBeVisible()

  // la formation vient d'être créée en "brouillon" (jamais publiée manuellement) mais doit
  // déjà apparaître sur la marketplace publique grâce à la publication automatique
  await page.goto('/solo/marketplace')
  const cartes = page.locator(`p:text-is("${titre}")`)
  await expect(cartes).toHaveCount(1)

  // nettoyage : suppression de la formation (aucune inscription dessus), cascade sur l'offre liée
  await page.goto('/solo/formations')
  const carte = page.locator('div.py-4').filter({ hasText: titre })
  await carte.getByRole('button', { name: 'Supprimer' }).click()
  await page.click('button:has-text("Supprimer définitivement")')
  await page.waitForLoadState('networkidle')

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
