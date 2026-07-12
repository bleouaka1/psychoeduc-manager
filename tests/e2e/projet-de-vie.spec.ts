import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'
const BENEFICIAIRE_EMAIL = 'e2e-beneficiaire-fixture@psychoeduc-manager.local'
const BENEFICIAIRE_PASSWORD = 'E2eBeneficiaireFixture2026!'

test('le praticien peut créer un projet de vie, le rattacher à un objectif, et le bénéficiaire le voit avec sa progression sur /mon-espace', async ({ page }) => {
  test.setTimeout(90_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/solo', { timeout: 45000 })

  const ts = Date.now()
  const nom = 'E2EProjetVie'
  const prenoms = `Beneficiaire${ts}`
  await page.goto('/solo/beneficiaires')
  await page.fill('input[name="nom"]', nom)
  await page.fill('input[name="prenoms"]', prenoms)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  const lien = page.getByRole('link', { name: `${nom} ${prenoms}` })
  await expect(lien).toBeVisible()
  await lien.click()
  await expect(page).toHaveURL(/\/solo\/beneficiaires\/[\w-]+$/, { timeout: 20000 })

  const panneauProjets = page.locator('section', { hasText: 'Projets de vie' })
  const titreProjet = `Alternance E2E ${ts}`
  await panneauProjets.locator('input[name="titre"]').fill(titreProjet)
  await panneauProjets.locator('input[name="description"]').fill('Trouver une alternance dans la vente')
  await panneauProjets.getByRole('button', { name: 'Créer' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('section', { hasText: 'Projets de vie' }).getByText(titreProjet)).toBeVisible()

  // Un deuxième projet, pour vérifier que plusieurs projets actifs coexistent réellement.
  const titreProjet2 = `Logement E2E ${ts}`
  await panneauProjets.locator('input[name="titre"]').fill(titreProjet2)
  await panneauProjets.getByRole('button', { name: 'Créer' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('section', { hasText: 'Projets de vie' }).getByText(titreProjet2)).toBeVisible()

  // Un objectif rattaché au premier projet, marqué atteint.
  const panneauObjectifs = page.locator('section', { hasText: 'Objectifs & jalons' })
  const titreObjectif = `CV E2E ${ts}`
  await panneauObjectifs.locator('input[name="titre"]').fill(titreObjectif)
  await panneauObjectifs.locator('select[name="projet_vie_id"]').selectOption({ label: titreProjet })
  await panneauObjectifs.getByRole('button', { name: 'Ajouter' }).click()
  await page.waitForLoadState('networkidle')

  const objectif = page.locator('li').filter({ hasText: titreObjectif })
  await objectif.getByRole('button', { name: 'Démarrer' }).click()
  await page.waitForLoadState('networkidle')
  await page.locator('li').filter({ hasText: titreObjectif }).getByRole('button', { name: 'Marquer atteint' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('li').filter({ hasText: titreObjectif }).getByText('Atteint')).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('le bénéficiaire voit son projet de vie principal (progression, fil d\'activité) sur /mon-espace, et peut créer un projet en autonomie', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', BENEFICIAIRE_EMAIL)
  await page.fill('#password', BENEFICIAIRE_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/mon-espace\/[\w-]+$/, { timeout: 45000 })

  await expect(page.getByRole('heading', { name: 'Projet de vie' })).toBeVisible()
  await expect(page.getByText('Trouver une alternance')).toBeVisible()
  await expect(page.getByText('50%')).toBeVisible() // 1 objectif atteint sur 2 rattachés au projet

  await page.getByText('Voir mes projets de vie').click()
  await expect(page).toHaveURL(/\/mon-espace\/[\w-]+\/projets-vie$/)
  await expect(page.getByRole('heading', { name: 'Mes projets de vie' })).toBeVisible()
  await expect(page.getByText('Étape franchie : Préparer un CV')).toBeVisible()

  const nouveauProjet = `Projet Autonomie E2E ${Date.now()}`
  await page.locator('input[name="titre"]').fill(nouveauProjet)
  await page.getByRole('button', { name: 'Créer un projet' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(nouveauProjet)).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
