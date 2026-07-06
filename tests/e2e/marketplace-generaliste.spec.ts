import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

test('un compte Solo peut soumettre une offre produit (en attente de validation) puis la retirer', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/')

  await page.goto('/solo/marketplace')
  const titre = `Produit E2E ${Date.now()}`
  await page.selectOption('select[name="type_offre"]', 'produit')
  await page.fill('input[name="titre"]', titre)
  await page.fill('input[name="prix"]', '3000')
  await page.click('button:has-text("Soumettre pour validation")')
  await page.waitForLoadState('networkidle')

  const ligne = page.locator('div.py-3').filter({ hasText: titre })
  await expect(ligne).toBeVisible()
  await expect(ligne.getByText('En attente de validation')).toBeVisible()

  await ligne.getByRole('button', { name: 'Retirer' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('div.py-3').filter({ hasText: titre }).getByText('Retirée')).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('un compte Solo peut modifier puis supprimer définitivement une offre marketplace', async ({ page }) => {
  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/')

  await page.goto('/solo/marketplace')
  const titre = `Produit E2E Edit ${Date.now()}`
  await page.selectOption('select[name="type_offre"]', 'produit')
  await page.fill('input[name="titre"]', titre)
  await page.click('button:has-text("Soumettre pour validation")')
  await page.waitForLoadState('networkidle')

  const carte = page.locator('div.py-3').filter({ hasText: titre })
  await expect(carte).toBeVisible()
  await carte.getByRole('link', { name: 'Modifier' }).click()
  await expect(page.getByText(`Modifier « ${titre} »`)).toBeVisible()

  const titreModifie = `${titre} (modifiée)`
  await page.fill('input[name="titre"]', titreModifie)
  await page.click('button:has-text("Enregistrer les modifications")')
  await page.waitForLoadState('networkidle')

  const carteModifiee = page.locator('div.py-3').filter({ hasText: titreModifie })
  await expect(carteModifiee).toBeVisible()

  await carteModifiee.getByRole('button', { name: 'Supprimer' }).click()
  await page.click('button:has-text("Supprimer définitivement")')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('div.py-3').filter({ hasText: titreModifie })).toHaveCount(0)
})

test('le filtre par type sur la marketplace publique fonctionne sans erreur JS', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/')

  await page.goto('/solo/marketplace')
  await page.getByRole('link', { name: 'Formations & compétences' }).click()
  await expect(page).toHaveURL(/type=formation/)

  await page.getByRole('link', { name: 'Entreprises (services & produits)' }).click()
  await expect(page).toHaveURL(/type=produit_service/)

  await page.goto('/solo/favoris')
  await expect(page.getByText('Mes favoris')).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
