import { test, expect } from '@playwright/test'

const BENEFICIAIRE_EMAIL = 'e2e-beneficiaire-fixture@psychoeduc-manager.local'
const BENEFICIAIRE_PASSWORD = 'E2eBeneficiaireFixture2026!'

test('un bénéficiaire connecté est redirigé vers /mon-espace et voit sa Boussole d\'Autonomie (score + radar)', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', BENEFICIAIRE_EMAIL)
  await page.fill('#password', BENEFICIAIRE_PASSWORD)
  await page.click('button[type="submit"]')

  // Un seul dossier lié à ce profil : redirection directe vers /mon-espace/[id],
  // jamais l'écran de choix (réservé au cas de plusieurs dossiers, cf. §4.2 du
  // document comptes-multiprofils).
  await expect(page).toHaveURL(/\/mon-espace\/[\w-]+$/, { timeout: 45000 })

  await expect(page.getByRole('heading', { name: 'Bonjour Beneficiaire' })).toBeVisible()
  // Apostrophe typographique (’) utilisée dans le rendu, pas l'apostrophe droite (') —
  // regex insensible au type d'apostrophe pour ne pas dépendre d'un choix typographique.
  await expect(page.getByText(/Boussole d.Autonomie/)).toBeVisible()
  await expect(page.getByText('62', { exact: true })).toBeVisible()
  // Radar SVG rendu avec au moins une dimension (8 pour IGA-J, jamais un total de 8
  // forcé arbitrairement pour un autre référentiel — cf. PLAN_COMPTES_MULTIPROFILS...).
  await expect(page.locator('svg polygon').first()).toBeVisible()

  // Aucun outil de modération/organisation ne doit apparaître dans cette vue.
  await expect(page.getByRole('button', { name: 'Valider' })).toHaveCount(0)

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('un bénéficiaire non authentifié visitant /mon-espace est renvoyé vers /login', async ({ page }) => {
  await page.goto('/mon-espace')
  await expect(page).toHaveURL(/\/login$/)
})
