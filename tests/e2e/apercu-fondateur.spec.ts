import { test, expect } from '@playwright/test'

const FONDATEUR_EMAIL = 'e2e-fondateur-fixture@psychoeduc-manager.local'
const FONDATEUR_PASSWORD = 'E2eFondateurFixture2026!'
// Structure/administrateur, jamais fondateur — sert à vérifier que /apercu lui reste fermé.
const NON_FONDATEUR_EMAIL = 'e2e-fixture@psychoeduc-manager.local'
const NON_FONDATEUR_PASSWORD = 'E2eFixtureTest2026!'

async function connecter(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
}

test('un Fondateur peut prévisualiser n\'importe quel tableau de bord (Structure et Solo) avec de vraies données, jamais un compte non-fondateur', async ({ page }) => {
  test.setTimeout(120_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  // 0. Un compte non-fondateur est redirigé loin de /apercu.
  await connecter(page, NON_FONDATEUR_EMAIL, NON_FONDATEUR_PASSWORD)
  await expect(page).toHaveURL('http://localhost:3000/dashboard', { timeout: 30000 })
  await page.goto('/apercu')
  await expect(page).toHaveURL('http://localhost:3000/dashboard', { timeout: 15000 })
  await page.context().clearCookies()

  // 1. Le Fondateur voit le hub d'aperçu avec au moins une Structure et un compte Solo.
  await connecter(page, FONDATEUR_EMAIL, FONDATEUR_PASSWORD)
  await expect(page).toHaveURL('http://localhost:3000/dashboard', { timeout: 30000 })
  await page.goto('/apercu')
  await expect(page.getByRole('heading', { name: 'Aperçu — voir en tant que' })).toBeVisible()

  // 2. Prévisualiser une Structure : redirigé vers /dashboard, voit le StructureDashboard
  // (pas le panorama plateforme) avec la bannière d'aperçu, données réelles de cette org.
  const panelStructures = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Structures' }) }).first()
  const premiereStructure = panelStructures.locator('li').first()
  await expect(premiereStructure).toBeVisible()
  await premiereStructure.getByRole('button', { name: 'Voir' }).click()
  await page.waitForLoadState('networkidle')

  await expect(page).toHaveURL('http://localhost:3000/dashboard')
  await expect(page.getByText('Mode Aperçu')).toBeVisible()
  await expect(page.getByText("Vue d'ensemble de votre organisation, en temps réel.")).toBeVisible()
  // Jamais le panorama plateforme pendant un aperçu Structure.
  await expect(page.getByText('Cockpit Fondateur')).toHaveCount(0)

  // 3. Quitter l'aperçu ramène au panorama Fondateur normal.
  await page.getByRole('button', { name: "Quitter l'aperçu" }).click()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL('http://localhost:3000/apercu')

  await page.goto('/dashboard')
  await expect(page.getByText('Cockpit Fondateur')).toBeVisible()
  await expect(page.getByText('Mode Aperçu')).toHaveCount(0)

  // 4. Prévisualiser un compte Solo : redirigé vers /solo, bannière visible.
  await page.goto('/apercu')
  const panelSolo = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Comptes Solo' }) }).first()
  const premierSolo = panelSolo.locator('li').first()
  await expect(premierSolo).toBeVisible()
  await premierSolo.getByRole('button', { name: 'Voir' }).click()
  await page.waitForLoadState('networkidle')

  await expect(page).toHaveURL('http://localhost:3000/solo')
  await expect(page.getByText('Mode Aperçu')).toBeVisible()

  await page.getByRole('button', { name: "Quitter l'aperçu" }).click()
  await page.waitForLoadState('networkidle')

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
