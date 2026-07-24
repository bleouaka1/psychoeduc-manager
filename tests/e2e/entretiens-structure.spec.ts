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

test('un Directeur peut ajouter un bénéficiaire, créer un entretien général avec Interlocuteur, le valider', async ({ page }) => {
  test.setTimeout(120_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)
  await page.goto('/beneficiaires')

  const nom = 'E2E'
  const prenoms = `Structure${Date.now()}`
  await page.fill('input[name="nom"]', nom)
  await page.fill('input[name="prenoms"]', prenoms)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  // Scopé à la ligne par le prénom (timestampé, unique) — la liste n'est pas filtrée par
  // organisation (vue Cockpit générique), "E2E" seul pourrait matcher d'autres fixtures.
  const ligne = page.locator('tr').filter({ hasText: prenoms })
  await expect(ligne).toBeVisible()
  await ligne.getByRole('link').click()
  await expect(page).toHaveURL(/\/beneficiaires\/[\w-]+$/, { timeout: 20000 })

  await page.click('button[name="type_entretien"][value="general"]')
  await expect(page).toHaveURL(/\/beneficiaires\/[\w-]+\/entretiens\/[\w-]+$/, { timeout: 20000 })

  // Interlocuteur — nouveau champ §4.2. Seul select dont une option est "Parent-Tuteur".
  const selectInterlocuteur = page.locator('select').filter({ has: page.locator('option', { hasText: 'Parent-Tuteur' }) })
  await selectInterlocuteur.selectOption('parent_tuteur')

  const synthese = `Synthèse Structure E2E ${Date.now()}`
  await page.locator('label:has-text("Synthèse générale") + textarea').fill(synthese)

  page.once('dialog', (dialog) => dialog.accept())
  await page.click('button:has-text("Valider l\'entretien")')
  await expect(page.getByText('Entretien validé.')).toBeVisible()
  await expect(page.getByText('Validé', { exact: true }).first()).toBeVisible()

  await page.goto(page.url().replace(/\/entretiens\/[\w-]+$/, ''))
  await expect(page.getByText(/Entretien Général — /)).toBeVisible()
  await expect(page.getByText('Validé', { exact: true }).first()).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
