import path from 'path'
import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/')
}

test('un compte Solo peut planifier puis terminer une séance de suivi au calendrier', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)
  await page.goto('/solo/calendrier')

  const titre = `Séance E2E ${Date.now()}`
  await page.fill('input[name="titre"]', titre)
  await page.selectOption('select[name="type_seance"]', 'suivi')
  // sélectionne le premier bénéficiaire disponible (la contrainte impose bénéficiaire OU formation)
  await page.selectOption('select[name="beneficiaire_id"]', { index: 1 })
  const dansUneHeure = new Date(Date.now() + 60 * 60 * 1000)
  const valeurLocale = dansUneHeure.toISOString().slice(0, 16)
  await page.fill('input[name="date_heure"]', valeurLocale)
  await page.click('button:has-text("Planifier")')
  await page.waitForLoadState('networkidle')

  const seance = page.locator('div.py-3').filter({ hasText: titre })
  await expect(seance).toBeVisible()

  await seance.getByRole('button', { name: 'Terminée' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('div.py-3').filter({ hasText: titre })).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test("un compte Solo peut téléverser puis supprimer une ressource jointe à une formation", async ({ page }) => {
  await connecter(page)
  await page.goto('/solo/formations')

  const titre = `Formation E2E Ressource ${Date.now()}`
  await page.fill('input[name="titre"]', titre)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  const carte = page.locator('div.py-4').filter({ hasText: titre })
  await expect(carte).toBeVisible()

  const nomFichier = `ressource-${Date.now()}.txt`
  const fichierTemp = path.join(process.cwd(), 'test-results', nomFichier)
  await page.context().addInitScript(() => {})
  const fs = await import('fs')
  fs.writeFileSync(fichierTemp, 'Contenu de test E2E.')

  await carte.locator('input[type="file"]').setInputFiles(fichierTemp)
  await carte.getByRole('button', { name: 'Ajouter' }).click()
  await page.waitForLoadState('networkidle')

  const lienFichier = carte.getByRole('link', { name: nomFichier })
  await expect(lienFichier).toBeVisible()

  await carte.getByRole('button', { name: `Supprimer ${nomFichier}` }).click()
  await page.waitForLoadState('networkidle')
  await expect(carte.getByRole('link', { name: nomFichier })).toHaveCount(0)

  fs.unlinkSync(fichierTemp)

  // nettoyage
  await carte.getByRole('button', { name: 'Supprimer' }).click()
  await page.click('button:has-text("Supprimer définitivement")')
})

test('un compte Solo peut modifier sa bio et ses spécialités sur le profil public', async ({ page }) => {
  await connecter(page)
  await page.goto('/solo/profil')

  const bio = `Bio de test E2E ${Date.now()}`
  await page.fill('textarea[name="bio"]', bio)
  await page.fill('input[name="specialites"]', 'Test A, Test B')
  await page.click('button:has-text("Enregistrer")')
  await page.waitForLoadState('networkidle')

  await expect(page.locator('p').filter({ hasText: bio })).toBeVisible()
  await expect(page.getByText('Test A')).toBeVisible()
  await expect(page.getByText('Test B')).toBeVisible()
})

test('la cloche de notifications du Compte Solo s\'ouvre et se ferme sans erreur', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)
  await page.goto('/solo')

  await page.click('button[aria-label="Notifications"]')
  await expect(page.getByText('Notifications', { exact: true })).toBeVisible()
  await page.click('button[aria-label="Notifications"]')

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
