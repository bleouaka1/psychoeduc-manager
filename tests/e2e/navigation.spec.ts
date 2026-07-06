import { test, expect } from '@playwright/test'

const FIXTURE_EMAIL = 'e2e-fixture@psychoeduc-manager.local'
const FIXTURE_PASSWORD = 'E2eFixtureTest2026!'

const ROUTES = [
  '/',
  '/organisations/solo',
  '/organisations/structures',
  '/organisations/employeurs',
  '/beneficiaires',
  '/iga',
  '/capital-social',
  '/agr',
  '/insertion',
  '/modules',
  '/licences',
  '/finances',
  '/marketplace',
  '/evenements',
  '/intelligence-economique',
  '/communication',
  '/ia',
  '/audit',
  '/support',
  '/parametres',
  '/statistiques',
  '/solo',
  '/solo/beneficiaires',
  '/solo/formations',
  '/solo/marketplace',
  '/solo/favoris',
  '/solo/calendrier',
  '/solo/revenus',
  '/solo/profil',
]

test('toutes les pages du menu latéral se chargent sans erreur JS ni erreur serveur', async ({ page }) => {
  // 28 navigations séquentielles : le timeout par défaut (30s) est trop juste dès qu'il
  // y a de la latence ambiante (ex. plusieurs sessions de dev partageant le même serveur).
  test.setTimeout(120_000)
  await page.goto('/login')
  await page.fill('#email', FIXTURE_EMAIL)
  await page.fill('#password', FIXTURE_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/')

  for (const route of ROUTES) {
    const erreursConsole: string[] = []
    page.on('pageerror', (err) => erreursConsole.push(err.message))

    const response = await page.goto(route)
    expect(response?.status(), `Route ${route} a retourné un statut HTTP inattendu`).toBeLessThan(400)
    expect(erreursConsole, `Erreurs JS sur ${route}: ${erreursConsole.join('\n')}`).toEqual([])
  }
})
