import { test, expect } from '@playwright/test'

const FONDATEUR_EMAIL = 'e2e-fondateur-fixture@psychoeduc-manager.local'
const FONDATEUR_PASSWORD = 'E2eFondateurFixture2026!'

test('un Fondateur ayant aussi un dossier bénéficiaire voit un lien de bascule vers /mon-espace, dans les deux sens', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', FONDATEUR_EMAIL)
  await page.fill('#password', FONDATEUR_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 45000 })

  // Depuis le Cockpit Fondateur : lien vers l'espace bénéficiaire (bascule gratuite, instantanée).
  await page.goto('/dashboard')
  const lienVersBeneficiaire = page.getByRole('link', { name: 'Mon espace bénéficiaire' })
  await expect(lienVersBeneficiaire).toBeVisible()
  await lienVersBeneficiaire.click()
  await expect(page).toHaveURL(/\/mon-espace/, { timeout: 20000 })

  // Depuis l'espace bénéficiaire : lien retour vers l'organisation, sans jamais déclencher de test IGA.
  await expect(page.getByRole('link', { name: 'Basculer vers mon espace organisation' })).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
