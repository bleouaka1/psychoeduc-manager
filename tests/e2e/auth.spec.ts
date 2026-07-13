import { test, expect } from '@playwright/test'

// Compte de test dédié, sans privilège particulier (organisation de test uniquement).
// Ne jamais utiliser de vrai compte utilisateur dans ce fichier.
const FIXTURE_EMAIL = 'e2e-fixture@psychoeduc-manager.local'
const FIXTURE_PASSWORD = 'E2eFixtureTest2026!'

test('un visiteur non authentifié voit la page d\'accueil publique et est redirigé vers /login sur une route protégée', async ({ page }) => {
  // '/' est la page d'accueil publique (vitrine) depuis l'ajout de la landing page —
  // le Cockpit Fondateur vit maintenant à /dashboard et reste protégé, lui.
  await page.goto('/')
  await expect(page).toHaveURL('http://localhost:3000/')
  await expect(page.getByRole('heading', { name: /Chaque parcours d'autonomie mérite d'être vu/ })).toBeVisible()

  await page.goto('/dashboard')
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

test('un identifiant valide connecte et affiche le Cockpit, puis la déconnexion ramène à /login', async ({ page }) => {
  // Contenu du tableau de bord (vue Fondateur vs vue Structure org-scopée) vérifié
  // séparément dans dashboard.spec.ts — ce test couvre uniquement la mécanique
  // connexion/menu/déconnexion, commune aux deux, avec e2e-fixture (compte Structure).
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', FIXTURE_EMAIL)
  await page.fill('#password', FIXTURE_PASSWORD)
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL('http://localhost:3000/dashboard')
  await expect(page.getByRole('main')).toBeVisible()

  // le menu est réduit par défaut ; l'ouvrir doit révéler l'email du compte connecté
  await page.click('button[aria-label="Ouvrir le menu"]')
  await expect(page.getByText(FIXTURE_EMAIL)).toBeVisible()
  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])

  await page.click('button:has-text("Déconnexion")')
  await expect(page).toHaveURL(/\/login$/)
})
