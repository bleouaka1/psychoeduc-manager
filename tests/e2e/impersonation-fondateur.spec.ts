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

test('la section impersonation de /apercu liste des comptes réels et échoue proprement sans SUPABASE_SERVICE_ROLE_KEY', async ({ page }) => {
  test.setTimeout(60_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)
  await page.goto('/apercu')

  await expect(page.getByRole('heading', { name: 'Mon Espace — bénéficiaires' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Espace Parent' })).toBeVisible()

  const panelBeneficiaires = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Mon Espace — bénéficiaires' }) })
  const premiereLigne = panelBeneficiaires.locator('li').first()

  // Sans SUPABASE_SERVICE_ROLE_KEY dans .env.local (pas encore ajoutée à ce stade), le
  // bouton doit échouer proprement — jamais une page d'erreur Next.js brute (crash serveur).
  if (await premiereLigne.count()) {
    await premiereLigne.getByRole('button', { name: 'Se connecter en tant que' }).click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/apercu\?erreur=/)
    await expect(page.getByText(/SUPABASE_SERVICE_ROLE_KEY|Impossible de générer la session/)).toBeVisible()
  }

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
