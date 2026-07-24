import { test, expect } from '@playwright/test'

const DIRECTEUR_EMAIL = 'e2e-structure-directeur-fixture@psychoeduc-manager.local'
const DIRECTEUR_PASSWORD = 'E2eStructureDirecteur2026!'
const BENEFICIAIRE_NOM = 'Fixture Assignation'

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', DIRECTEUR_EMAIL)
  await page.fill('#password', DIRECTEUR_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/dashboard', { timeout: 30000 })
}

test('un Directeur active le module Gestion Administrative, crée une classe, inscrit un bénéficiaire et prend la présence du jour', async ({ page }) => {
  test.setTimeout(120_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)

  // 0. Le module est désactivé par défaut : l'activer si ce n'est pas déjà fait (fixture
  // réutilisée d'un run à l'autre, l'activation est donc idempotente ici).
  await page.goto('/parametres-organisation')
  const caseModule = page.locator('#module_admin_actif')
  if (!(await caseModule.isChecked())) {
    await caseModule.check()
    await page.click('button:has-text("Enregistrer")')
    await page.waitForLoadState('networkidle')
  }

  // Le lien "Présences" apparaît maintenant dans la nav (module actif).
  await expect(page.getByRole('link', { name: 'Présences' })).toBeVisible()

  // 1. Créer une classe timestampée pour ne pas collisionner avec un run précédent.
  await page.goto('/presences')
  const nomClasse = `Classe E2E ${Date.now()}`
  await page.fill('input[name="nom"]', nomClasse)
  await page.click('button:has-text("Créer")')
  await page.waitForLoadState('networkidle')

  const lienClasse = page.getByRole('link', { name: nomClasse })
  await expect(lienClasse).toBeVisible()
  await lienClasse.click()
  await page.waitForLoadState('networkidle')

  // 2. Inscrire le bénéficiaire fixture (peut déjà être inscrit dans d'autres classes — sans
  // incidence, l'inscription est propre à cette classe précise, tout juste créée donc vide).
  const selectBeneficiaire = page.locator('select[name="beneficiaire_id"]')
  await selectBeneficiaire.selectOption({ label: BENEFICIAIRE_NOM })
  await page.click('button:has-text("Inscrire")')
  await page.waitForLoadState('networkidle')

  const ligneBeneficiaire = page.locator('li').filter({ hasText: BENEFICIAIRE_NOM })
  await expect(ligneBeneficiaire).toBeVisible()

  // 3. Prendre la présence du jour : Présent.
  await ligneBeneficiaire.getByRole('button', { name: 'Présent' }).click()
  await page.waitForLoadState('networkidle')

  // Le bouton "Présent" reflète l'état actif après ressaisie (upsert, pas de doublon).
  await expect(page.locator('li').filter({ hasText: BENEFICIAIRE_NOM }).getByRole('button', { name: 'Présent' })).toHaveClass(/bg-accent-teal/)

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
