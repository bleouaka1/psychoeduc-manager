import { test, expect } from '@playwright/test'

// Compte de test dédié, sans privilège particulier (organisation de test uniquement).
// Ne jamais utiliser de vrai compte utilisateur dans ce fichier.
const FIXTURE_EMAIL = 'e2e-fixture@psychoeduc-manager.local'
const FIXTURE_PASSWORD = 'E2eFixtureTest2026!'

test('un visiteur non authentifié est redirigé vers /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'PsychoÉduc Manager' })).toBeVisible()
})

test('un mot de passe invalide affiche une erreur et ne connecte pas', async ({ page }) => {
  await page.goto('/login')
  await page.fill('#email', FIXTURE_EMAIL)
  await page.fill('#password', 'mot-de-passe-incorrect')
  await page.click('button[type="submit"]')

  await expect(page.getByText('Identifiants invalides.')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('un identifiant valide connecte et affiche le cockpit fondateur, puis la déconnexion ramène à /login', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', FIXTURE_EMAIL)
  await page.fill('#password', FIXTURE_PASSWORD)
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL('http://localhost:3000/')
  await expect(page.getByText('Cockpit Fondateur')).toBeVisible()

  // le menu est réduit par défaut ; l'ouvrir doit révéler l'email du compte connecté
  await page.click('button[aria-label="Ouvrir le menu"]')
  await expect(page.getByText(FIXTURE_EMAIL)).toBeVisible()
  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])

  await page.click('button:has-text("Déconnexion")')
  await expect(page).toHaveURL(/\/login$/)
})
