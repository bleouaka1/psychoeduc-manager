import { test, expect } from '@playwright/test'

const FONDATEUR_EMAIL = 'e2e-fondateur-fixture@psychoeduc-manager.local'
const FONDATEUR_PASSWORD = 'E2eFondateurFixture2026!'

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', FONDATEUR_EMAIL)
  await page.fill('#password', FONDATEUR_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/dashboard', { timeout: 30000 })
}

test('la section impersonation de /apercu liste des rôles réels', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)
  await page.goto('/apercu')

  await expect(page.getByRole('heading', { name: 'Mon Espace — bénéficiaires' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Espace Parent' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Personnel Structure — par rôle' })).toBeVisible()

  // Les 6 rôles Structure ont chacun au moins un compte de test réel (fixtures créées pour
  // compléter les exemples) — chaque groupe doit apparaître, pas seulement les rôles les
  // plus anciennement testés (Directeur/Formateur).
  for (const role of ['Promoteur', 'Directeur', 'Coordinateur', 'Éducateur', 'Formateur']) {
    await expect(page.getByText(role, { exact: true })).toBeVisible()
  }

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test("un Fondateur se connecte réellement en tant qu'un bénéficiaire, voit sa Boussole d'Autonomie, puis retrouve sa propre session en quittant l'impersonation", async ({ page }) => {
  test.setTimeout(90_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)
  await page.goto('/apercu')

  const panelBeneficiaires = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Mon Espace — bénéficiaires' }) })
  const ligneBeneficiaire = panelBeneficiaires.locator('li').filter({ hasText: 'Fixture Beneficiaire' })
  await expect(ligneBeneficiaire).toBeVisible()
  await ligneBeneficiaire.getByRole('button', { name: 'Se connecter en tant que' }).click()
  await page.waitForLoadState('networkidle')

  // Un seul dossier lié à ce profil : redirection directe vers /mon-espace/[id].
  await expect(page).toHaveURL(/\/mon-espace(\/[\w-]+)?$/, { timeout: 30000 })
  await expect(page.getByText('Impersonation Fondateur en cours')).toBeVisible()
  await expect(page.getByText(/Boussole d.Autonomie/)).toBeVisible()

  // Quitter l'impersonation restaure la session Fondateur sans avoir à se reconnecter.
  await page.getByRole('button', { name: "Quitter l'impersonation" }).click()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL('http://localhost:3000/apercu', { timeout: 15000 })

  // La session restaurée est bien celle du Fondateur, pas une session délogée.
  await page.goto('/dashboard')
  await expect(page.getByText('Cockpit Fondateur')).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
