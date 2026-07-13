import { test, expect } from '@playwright/test'

const DIRECTEUR_EMAIL = 'e2e-structure-directeur-fixture@psychoeduc-manager.local'
const DIRECTEUR_PASSWORD = 'E2eStructureDirecteur2026!'
const FORMATEUR_EMAIL = 'e2e-structure-formateur-fixture@psychoeduc-manager.local'
const FORMATEUR_PASSWORD = 'E2eStructureFormateur2026!'
const BENEFICIAIRE_NOM = 'Fixture Assignation'

// Sur /beneficiaires (Cockpit), nom et prénoms sont rendus dans deux <td> distincts —
// un getByText sur le nom complet ne matche donc rien ; on cible la ligne du tableau.
function ligneBeneficiaireCockpit(page: import('@playwright/test').Page) {
  return page.locator('tr').filter({ hasText: 'Fixture' }).filter({ hasText: 'Assignation' })
}

async function connecter(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/dashboard', { timeout: 30000 })
}

test('un formateur ne voit un bénéficiaire qu\'une fois assigné par le Directeur, jamais avant, et plus après la fin de l\'assignation', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  // 0. Nettoyage : un run précédent interrompu peut avoir laissé une assignation active
  // sur ce bénéficiaire fixture (partagé entre runs, contrairement aux entités habituellement
  // créées avec un suffixe timestampé). Termine toute assignation active avant de commencer.
  await connecter(page, DIRECTEUR_EMAIL, DIRECTEUR_PASSWORD)
  await page.goto('/assignations')
  const ligneExistante = page.locator('tr').filter({ hasText: BENEFICIAIRE_NOM }).filter({ hasText: 'Active' })
  while ((await ligneExistante.count()) > 0) {
    await ligneExistante.first().getByRole('button', { name: 'Terminer' }).click()
    await page.waitForLoadState('networkidle')
  }

  // 1. Le formateur, avant toute assignation, ne voit PAS le bénéficiaire fixture
  // (ni sur /beneficiaires, ni sur /assignations : accès suit l'assignation, jamais le rôle).
  const contexteFormateur = await browser.newContext()
  const pageFormateur = await contexteFormateur.newPage()
  await connecter(pageFormateur, FORMATEUR_EMAIL, FORMATEUR_PASSWORD)
  await pageFormateur.goto('/beneficiaires')
  await expect(ligneBeneficiaireCockpit(pageFormateur)).toHaveCount(0)
  await pageFormateur.goto('/assignations')
  // Le formateur n'a pas les droits d'assignation : le formulaire "Nouvelle assignation" est absent.
  await expect(pageFormateur.getByText('Nouvelle assignation')).toHaveCount(0)

  // 2. Le Directeur assigne le formateur au bénéficiaire fixture.
  await page.goto('/assignations')
  await expect(page.getByText('Nouvelle assignation')).toBeVisible()

  await page.selectOption('select[name="beneficiaire_id"]', { label: BENEFICIAIRE_NOM })
  await page.selectOption('select[name="formateur_membre_organisation_id"]', { index: 0 })
  await page.click('button:has-text("Assigner")')
  await page.waitForLoadState('networkidle')

  const ligneAssignation = page.locator('tr').filter({ hasText: BENEFICIAIRE_NOM }).filter({ hasText: 'Active' }).first()
  await expect(ligneAssignation).toBeVisible()

  // 3. Le formateur voit maintenant le bénéficiaire (nouvelle page, session déjà connectée).
  await pageFormateur.goto('/beneficiaires', { waitUntil: 'networkidle' })
  await expect(ligneBeneficiaireCockpit(pageFormateur)).toBeVisible({ timeout: 15000 })

  // 4. Le Directeur termine l'assignation ; le formateur ne voit plus le bénéficiaire.
  await ligneAssignation.getByRole('button', { name: 'Terminer' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('tr').filter({ hasText: BENEFICIAIRE_NOM }).first().getByText('Terminée')).toBeVisible()

  await pageFormateur.goto('/beneficiaires', { waitUntil: 'networkidle' })
  await expect(ligneBeneficiaireCockpit(pageFormateur)).toHaveCount(0)

  await contexteFormateur.close()
  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
