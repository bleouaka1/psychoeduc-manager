import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

test('activer l\'accès bénéficiaire depuis la fiche génère un lien d\'invitation valide, consommable sur /inscription-beneficiaire', async ({ page, context }) => {
  test.setTimeout(90_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/solo', { timeout: 45000 })

  const ts = Date.now()
  const nom = 'E2EAcces'
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

  // Aucun e-mail sur ce dossier tout juste créé : le bouton d'activation n'apparaît pas encore.
  await expect(page.getByRole('button', { name: "Activer l'accès bénéficiaire" })).toHaveCount(0)

  const email = `e2e-acces-${ts}@example.com`
  const panneauAcces = page.locator('section', { hasText: 'Accès bénéficiaire' })
  await panneauAcces.locator('input[name="email"]').fill(email)
  await panneauAcces.getByRole('button', { name: 'Enregistrer' }).click()
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: "Activer l'accès bénéficiaire" }).click()
  await page.waitForLoadState('networkidle')

  const lienInvitation = page.locator('code', { hasText: '/inscription-beneficiaire?token=' })
  await expect(lienInvitation).toBeVisible()
  const urlInvitation = (await lienInvitation.textContent())?.trim() ?? ''
  expect(urlInvitation).toContain('/inscription-beneficiaire?token=')

  // Ré-activer n'importe quoi de plus : idempotent, pas de deuxième invitation créée.
  await expect(page.getByRole('button', { name: "Activer l'accès bénéficiaire" })).toHaveCount(0)

  // Le lien est consommé dans un contexte séparé (le bénéficiaire, jamais connecté).
  const visiteur = await context.browser()!.newContext()
  const pageVisiteur = await visiteur.newPage()
  await pageVisiteur.goto(urlInvitation)
  await expect(pageVisiteur.getByRole('heading', { name: `Bonjour ${prenoms}` })).toBeVisible()
  await expect(pageVisiteur.locator('input#email')).toHaveValue(email)

  await pageVisiteur.fill('input#password', 'MotDePasseE2E2026!')
  await pageVisiteur.click('button:has-text("Créer mon accès")')
  // N'affirme pas l'issue exacte (dépend de la configuration e-mail/quota du projet Supabase,
  // hors du contrôle du code applicatif — même pattern que tests/e2e/inscription.spec.ts) :
  // vérifie seulement que le formulaire réagit proprement. La finalisation réelle du
  // rattachement (profile_id posé, invitation marquée acceptée) est vérifiée en isolation,
  // de façon déterministe, par supabase/tests/test_comptes_multiprofils_beneficiaire.sql.
  await expect(pageVisiteur.getByText(/Vérifiez votre boîte mail|Impossible de créer le compte|compte existe déjà/)).toBeVisible({ timeout: 20000 })
  await visiteur.close()

  // Un lien déjà utilisé/invalide affiche un message clair, jamais une page cassée.
  // Contexte non authentifié requis : `page` est connectée (Solo), et /inscription-beneficiaire
  // fait partie des AUTH_FORM_PATHS du middleware (redirection automatique si déjà connecté).
  const visiteurInvalide = await context.browser()!.newContext()
  const pageInvalide = await visiteurInvalide.newPage()
  await pageInvalide.goto('/inscription-beneficiaire?token=un-token-qui-n-existe-pas')
  await expect(pageInvalide.getByRole('heading', { name: 'Lien invalide ou expiré' })).toBeVisible()
  await visiteurInvalide.close()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
