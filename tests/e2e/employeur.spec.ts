import { test, expect } from '@playwright/test'

const EMPLOYEUR_EMAIL = 'e2e-employeur-fixture@psychoeduc-manager.local'
const EMPLOYEUR_PASSWORD = 'E2eEmployeurFixture2026!'

test('un compte Employeur peut créer, modifier, retirer puis supprimer une offre', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', EMPLOYEUR_EMAIL)
  await page.fill('#password', EMPLOYEUR_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/employeur')

  await page.goto('/employeur')
  await expect(page.getByText('Mes offres', { exact: true }).first()).toBeVisible()

  const titre = `Offre Employeur E2E ${Date.now()}`
  await page.selectOption('select[name="type_offre"]', 'service')
  await page.fill('input[name="titre"]', titre)
  await page.fill('input[name="prix"]', '15000')
  await page.fill('input[name="duree_texte"]', '3 heures')
  await page.click('button:has-text("Soumettre pour validation")')
  await page.waitForLoadState('networkidle')

  const carte = page.locator('div.py-3').filter({ hasText: titre })
  await expect(carte).toBeVisible()
  await expect(carte.getByText('En attente de validation')).toBeVisible()

  await carte.getByRole('link', { name: 'Modifier' }).click()
  await expect(page.getByText(`Modifier « ${titre} »`)).toBeVisible()
  const titreModifie = `${titre} (modifiée)`
  await page.fill('input[name="titre"]', titreModifie)
  await page.click('button:has-text("Enregistrer les modifications")')
  await page.waitForLoadState('networkidle')

  const carteModifiee = page.locator('div.py-3').filter({ hasText: titreModifie })
  await expect(carteModifiee).toBeVisible()

  await carteModifiee.getByRole('button', { name: 'Retirer' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('div.py-3').filter({ hasText: titreModifie }).getByText('Retirée')).toBeVisible()

  await carteModifiee.getByRole('button', { name: 'Supprimer' }).click()
  await page.click('button:has-text("Supprimer définitivement")')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('div.py-3').filter({ hasText: titreModifie })).toHaveCount(0)

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
