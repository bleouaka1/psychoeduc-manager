import { test, expect } from '@playwright/test'

// e2e-fixture est administrateur d'une organisation Structure, jamais fondateur —
// utilisé pour vérifier le nouveau tableau de bord org-scopé (StructureDashboard).
// e2e-fondateur-fixture porte le vrai rôle plateforme 'fondateur' (créé pour la
// modération marketplace) — seul compte qui doit voir le panorama Fondateur global.
const FIXTURE_EMAIL = 'e2e-fixture@psychoeduc-manager.local'
const FIXTURE_PASSWORD = 'E2eFixtureTest2026!'
const FONDATEUR_EMAIL = 'e2e-fondateur-fixture@psychoeduc-manager.local'
const FONDATEUR_PASSWORD = 'E2eFondateurFixture2026!'
// Rôle 'formateur' seul (aucun rôle de gouvernance) — doit voir la vue étroite
// "Mes bénéficiaires assignés", jamais les compteurs org-wide de la vue gouvernance.
const FORMATEUR_EMAIL = 'e2e-structure-formateur-fixture@psychoeduc-manager.local'
const FORMATEUR_PASSWORD = 'E2eStructureFormateur2026!'

test('le cockpit fondateur affiche les métriques plateforme sans erreur JS (compte fondateur uniquement)', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') erreursConsole.push(msg.text())
  })

  await page.goto('/login')
  await page.fill('#email', FONDATEUR_EMAIL)
  await page.fill('#password', FONDATEUR_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/dashboard')

  const main = page.getByRole('main')
  // Scopé à <main> : le route announcer d'accessibilité de Next.js (hors <main>) répète
  // aussi "Cockpit Fondateur" via le <title> de la page, ce qui ferait échouer un
  // getByText page-entière en "strict mode violation" (2 éléments correspondants).
  await expect(main.getByText('Cockpit Fondateur')).toBeVisible()
  await expect(main.getByText('Organisations', { exact: true })).toBeVisible()
  await expect(main.getByText('Bénéficiaires', { exact: true })).toBeVisible()
  await expect(main.getByText('Évaluations IGA', { exact: true })).toBeVisible()
  await expect(main.getByText('Score IGA moyen', { exact: true })).toBeVisible()
  await expect(main.getByText('Licences actives', { exact: true })).toBeVisible()
  await expect(main.getByText('Essais gratuits', { exact: true })).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('un compte Structure non-fondateur voit son propre tableau de bord org-scopé, jamais le panorama plateforme', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', FIXTURE_EMAIL)
  await page.fill('#password', FIXTURE_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/dashboard')

  const main = page.getByRole('main')
  await expect(main.getByText('Cockpit Fondateur')).toHaveCount(0)
  await expect(main.getByText('Établissements actifs')).toBeVisible()
  await expect(main.getByText('Bénéficiaires actifs')).toBeVisible()
  await expect(main.getByText('Invitations en attente')).toBeVisible()
  await expect(main.getByText('Présences du jour')).toBeVisible()
  await expect(main.getByText('Équipe', { exact: true })).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('un Formateur (aucun rôle de gouvernance) voit uniquement ses bénéficiaires assignés, jamais les compteurs org-wide', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', FORMATEUR_EMAIL)
  await page.fill('#password', FORMATEUR_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/dashboard')

  const main = page.getByRole('main')
  await expect(main.getByText('Mes bénéficiaires assignés')).toBeVisible()
  await expect(main.getByText('Établissements actifs')).toHaveCount(0)
  await expect(main.getByText('Invitations en attente')).toHaveCount(0)

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
