import { test, expect, type Browser } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'
// Compte fondateur dédié créé pour ce test (rôle 'fondateur' réel, actif) — l'ancien
// FIXTURE_EMAIL de dashboard.spec.ts n'a que le rôle 'administrateur', pas 'fondateur'.
const FONDATEUR_EMAIL = 'e2e-fondateur-fixture@psychoeduc-manager.local'
const FONDATEUR_PASSWORD = 'E2eFondateurFixture2026!'
const LOGIN_TIMEOUT = 40_000

async function connecter(browser: Browser, email: string, password: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  // Timeout étendu : latence observée vers Supabase Auth sous contention partagée
  // (même constat que la session concurrente, cf. son commit "timeouts explicitement étendus").
  // Destination post-connexion dépend du rôle (Solo → /solo, Fondateur → /dashboard) —
  // cette fonction sert les deux, donc on vérifie juste que la connexion a réussi.
  await expect(page).not.toHaveURL(/\/login$/, { timeout: LOGIN_TIMEOUT })
  return { context, page }
}

test('le Fondateur peut Valider, Suspendre puis Supprimer une offre marketplace depuis /marketplace', async ({ browser }) => {
  test.setTimeout(300_000)
  const erreursConsole: string[] = []

  // 1. Un compte Solo soumet une offre (en_attente_validation) — contexte dédié.
  const solo = await connecter(browser, SOLO_EMAIL, SOLO_PASSWORD)
  solo.page.on('pageerror', (err) => erreursConsole.push(err.message))

  await solo.page.goto('/solo/marketplace')
  const titre = `Produit Moderation E2E ${Date.now()}`
  await solo.page.selectOption('select[name="type_offre"]', 'produit')
  await solo.page.fill('input[name="titre"]', titre)
  await solo.page.fill('input[name="prix"]', '4000')
  // Image de couverture requise pour que la transition vers "publiee" (Valider) soit possible
  // (trigger enforce_marketplace_offre_statut) — sans elle, Valider échoue avec un message clair.
  await solo.page.fill('input[name="image_couverture_url"]', 'https://example.test/cover-e2e.jpg')
  await solo.page.click('button:has-text("Soumettre pour validation")')
  // Attend la confirmation réelle (offre listée) avant de fermer le contexte —
  // fermer trop tôt peut interrompre la Server Action de soumission en vol.
  await expect(solo.page.getByText(titre).first()).toBeVisible({ timeout: 45_000 })
  await solo.context.close()

  // 2. Le Fondateur se connecte (contexte séparé, pas de logout/relogin fragile) et modère l'offre.
  const fondateur = await connecter(browser, FONDATEUR_EMAIL, FONDATEUR_PASSWORD)
  const { page } = fondateur
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/marketplace')
  const ligne = page.locator('tr').filter({ hasText: titre })
  await expect(ligne).toBeVisible({ timeout: 45_000 })
  await expect(ligne.getByText('En attente de validation')).toBeVisible()

  // Fiche détail (lecture seule)
  await ligne.getByRole('link', { name: /Détail/ }).click()
  await expect(page.getByRole('heading', { name: titre, level: 3 })).toBeVisible()
  await expect(page.getByText('Aucun message pour cette offre pour le moment.')).toBeVisible()
  await page.getByLabel('Fermer').click()

  // Modale de confirmation scopée à son overlay : avec plusieurs offres "en_attente_validation"
  // simultanément sur la page, chacune a son propre bouton déclencheur "Valider"/"Suspendre"/
  // "Supprimer" — .last() page-wide matcherait n'importe lequel d'entre eux, pas forcément le
  // bouton de confirmation de LA modale actuellement ouverte.
  const modaleOuverte = page.locator('div.fixed.inset-0.z-50')

  // Valider
  const ligneApresDetail = page.locator('tr').filter({ hasText: titre })
  await ligneApresDetail.getByRole('button', { name: 'Valider' }).click()
  await modaleOuverte.getByRole('button', { name: 'Valider', exact: true }).click()
  await expect(page.locator('tr').filter({ hasText: titre }).getByText('Publiée')).toBeVisible()

  // Suspendre (avec motif)
  const ligneApresValidation = page.locator('tr').filter({ hasText: titre })
  await ligneApresValidation.getByRole('button', { name: 'Suspendre' }).click()
  await modaleOuverte.locator('textarea[placeholder*="suspension"]').fill('Motif de test E2E')
  await modaleOuverte.getByRole('button', { name: 'Suspendre', exact: true }).click()
  await expect(page.locator('tr').filter({ hasText: titre }).getByText('Suspendue')).toBeVisible()

  // Supprimer (logique)
  const ligneApresSuspension = page.locator('tr').filter({ hasText: titre })
  await ligneApresSuspension.getByRole('button', { name: 'Supprimer' }).click()
  await modaleOuverte.getByRole('button', { name: 'Supprimer', exact: true }).click()
  await expect(page.locator('tr').filter({ hasText: titre }).getByText('Supprimée')).toBeVisible()
  // Une offre "retiree" ne propose plus de bouton Supprimer (garde-fou idempotent)
  await expect(page.locator('tr').filter({ hasText: titre }).getByRole('button', { name: 'Supprimer' })).toHaveCount(0)

  await fondateur.context.close()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('un compte non-Fondateur ne voit pas le bouton Valider sur /marketplace', async ({ browser }) => {
  test.setTimeout(60_000)
  const solo = await connecter(browser, SOLO_EMAIL, SOLO_PASSWORD)

  // Un compte Solo n'a pas accès aux mêmes menus, mais la route reste accessible
  // (middleware = auth uniquement, pas de contrôle de rôle) : vérifie que le bouton
  // Valider est bien absent même en y accédant directement.
  await solo.page.goto('/marketplace')
  await expect(solo.page.getByRole('button', { name: 'Valider' })).toHaveCount(0)
  await solo.context.close()
})
