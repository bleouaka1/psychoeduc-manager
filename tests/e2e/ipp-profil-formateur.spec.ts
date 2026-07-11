import { test, expect, type Browser } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'
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
  await expect(page).not.toHaveURL(/\/login$/, { timeout: LOGIN_TIMEOUT })
  return { context, page }
}

test('avis bénéficiaire : soumission, modération Fondateur, puis visibilité sur le profil public (prénom + initiale uniquement)', async ({ browser }) => {
  test.setTimeout(180_000)
  const erreursConsole: string[] = []

  const solo = await connecter(browser, SOLO_EMAIL, SOLO_PASSWORD)
  const { page } = solo
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  const ts = Date.now()
  const nom = 'E2EAvis'
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

  // Avis destiné à être publié
  const texteAPublier = `Avis Publie E2E ${ts}`
  await page.selectOption('select[name="auteur_type"]', 'beneficiaire')
  await page.selectOption('select[name="note"]', '5')
  await page.fill('input[name="texte"]', texteAPublier)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.waitForLoadState('networkidle')
  const ligneAPublier = page.locator('li').filter({ hasText: texteAPublier })
  await expect(ligneAPublier).toBeVisible()
  await expect(ligneAPublier.getByText('En vérification')).toBeVisible()

  // Second avis, volontairement laissé non modéré — ne doit jamais apparaître publiquement
  const texteNonPublie = `Avis NonPublie E2E ${ts}`
  await page.selectOption('select[name="auteur_type"]', 'parent_tuteur')
  await page.selectOption('select[name="note"]', '3')
  await page.fill('input[name="texte"]', texteNonPublie)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.waitForLoadState('networkidle')
  const ligneNonPubliee = page.locator('li').filter({ hasText: texteNonPublie })
  await expect(ligneNonPubliee).toBeVisible()
  await expect(ligneNonPubliee.getByText('En vérification')).toBeVisible()

  // Formation dédiée uniquement pour retrouver l'organisationId de ce compte Solo (lien
  // "Voir le profil" de la page détail formation) — /solo/marketplace exclut délibérément
  // la propre organisation du visiteur, donc pas moyen de la retrouver depuis la grille.
  await page.goto('/solo/formations')
  const titreFormation = `Formation IppTest E2E ${ts}`
  await page.fill('input[name="titre"]', titreFormation)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')
  const carteFormation = page.locator('div.py-4').filter({ hasText: titreFormation })
  await expect(carteFormation).toBeVisible({ timeout: 15000 })
  const hrefModifier = await carteFormation.getByRole('link', { name: 'Modifier' }).getAttribute('href')
  const formationId = new URL(hrefModifier ?? '', 'http://localhost:3000').searchParams.get('edit')
  await page.goto(`/solo/marketplace/formation/${formationId}`)
  const hrefFormateur = await page.getByRole('link', { name: 'Voir le profil complet' }).getAttribute('href')
  const organisationId = (hrefFormateur ?? '').split('/solo/marketplace/formateur/')[1]
  expect(organisationId).toBeTruthy()

  // Modération Fondateur (contexte séparé)
  const fondateur = await connecter(browser, FONDATEUR_EMAIL, FONDATEUR_PASSWORD)
  fondateur.page.on('pageerror', (err) => erreursConsole.push(err.message))
  await fondateur.page.goto('/avis')
  const ligneModeration = fondateur.page.locator('tr').filter({ hasText: texteAPublier })
  await expect(ligneModeration).toBeVisible({ timeout: 20000 })
  await ligneModeration.getByRole('button', { name: 'Publier' }).click()
  const modaleOuverte = fondateur.page.locator('div.fixed.inset-0.z-50')
  await modaleOuverte.getByRole('button', { name: 'Publier', exact: true }).click()
  await expect(fondateur.page.locator('tr').filter({ hasText: texteAPublier }).getByText('Publié')).toBeVisible()
  // L'autre avis n'est pas touché, reste "En vérification"
  await expect(fondateur.page.locator('tr').filter({ hasText: texteNonPublie }).getByText('En vérification')).toBeVisible()
  await fondateur.context.close()

  // Profil public : seul l'avis publié apparaît, avec prénom + initiale uniquement
  await page.goto(`/solo/marketplace/formateur/${organisationId}`)
  await expect(page.getByRole('heading', { name: 'Indice de Performance Pédagogique (IPP)' })).toBeVisible()
  // Ce fixture Solo n'a jamais reçu d'évaluation IGA réelle : échantillon insuffisant,
  // le score chiffré ne doit donc jamais s'afficher (garde-fou seuil, jamais une valeur à 0/neutre).
  await expect(page.getByText('IPP en cours de constitution')).toBeVisible()
  // Aucune affectation de ce fixture n'atteint jamais 365 jours (créé pendant la session
  // de test) : le panneau paliers de réussite doit rester totalement absent, pas vide.
  await expect(page.getByRole('heading', { name: 'Paliers de réussite long terme' })).toHaveCount(0)

  const initiale = nom.slice(0, 1).toUpperCase()
  await expect(page.getByText(`${prenoms} ${initiale}.`, { exact: false })).toBeVisible()
  await expect(page.getByText(texteAPublier)).toBeVisible()
  await expect(page.getByText(texteNonPublie)).toHaveCount(0)

  // Nettoyage : suppression de la formation de test (cascade sur l'offre marketplace liée)
  await page.goto('/solo/formations')
  const carteASupprimer = page.locator('div.py-4').filter({ hasText: titreFormation })
  await carteASupprimer.getByRole('button', { name: 'Supprimer' }).click()
  await page.click('button:has-text("Supprimer définitivement")')
  await page.waitForLoadState('networkidle')

  await solo.context.close()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
