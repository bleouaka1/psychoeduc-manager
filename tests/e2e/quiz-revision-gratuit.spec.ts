import { test, expect, type Browser } from '@playwright/test'

const BENEFICIAIRE_EMAIL = 'e2e-beneficiaire-fixture@psychoeduc-manager.local'
const BENEFICIAIRE_PASSWORD = 'E2eBeneficiaireFixture2026!'
const FONDATEUR_EMAIL = 'e2e-fondateur-fixture@psychoeduc-manager.local'
const FONDATEUR_PASSWORD = 'E2eFondateurFixture2026!'

async function connecter(browser: Browser, email: string, password: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await expect(page).not.toHaveURL(/\/login/, { timeout: 40_000 })
  return { context, page }
}

// Parcours complet du palier de BASE (aucune dépendance à une clé API) :
// dépôt → validation par le Fondateur → génération sans IA → passation → score enregistré.
// Depuis le Lot H (dashboard bénéficiaire v3), la génération exige un abonnement de
// base actif (200 FCFA/mois) — le fixture e2e-beneficiaire a une ligne abonnements_base
// active seedée manuellement en base (aucun prestataire de paiement configuré pour la
// souscrire via l'UI), même principe que credits_revision pour le palier payant.
test('un bénéficiaire dépose un support, le Fondateur le valide, génère et passe un quiz gratuit', async ({ browser }) => {
  test.setTimeout(300_000)

  const beneficiaire = await connecter(browser, BENEFICIAIRE_EMAIL, BENEFICIAIRE_PASSWORD)
  await beneficiaire.page.goto('/mon-espace')
  const urlDossier = beneficiaire.page.url()
  const beneficiaireId = urlDossier.match(/\/mon-espace\/([^/]+)/)?.[1]
  expect(beneficiaireId).toBeTruthy()

  await beneficiaire.page.goto(`/mon-espace/${beneficiaireId}/revisions`)
  const titre = `Support E2E ${Date.now()}`
  await beneficiaire.page.fill('input[name="nom_fichier"]', titre)
  await beneficiaire.page.fill(
    'textarea[name="contenu_texte"]',
    `La menuiserie est l'art de travailler le bois pour fabriquer des meubles et des structures durables.
Un tenon désigne une pièce saillante taillée à l'extrémité d'une pièce de bois, destinée à s'insérer dans une mortaise.
Le rabot est un outil qui permet de lisser et d'aplanir une surface de bois avant assemblage.`,
  )
  await beneficiaire.page.click('button:has-text("Déposer")')
  const ligneDepot = beneficiaire.page.locator('li').filter({ hasText: titre })
  await expect(ligneDepot).toBeVisible({ timeout: 20_000 })
  await expect(ligneDepot.getByText('En attente de validation')).toBeVisible()

  const fondateur = await connecter(browser, FONDATEUR_EMAIL, FONDATEUR_PASSWORD)
  await fondateur.page.goto(`/mon-espace/${beneficiaireId}/revisions`)
  const ligneDocument = fondateur.page.locator('li').filter({ hasText: titre })
  await expect(ligneDocument).toBeVisible({ timeout: 20_000 })
  await ligneDocument.getByRole('button', { name: 'Valider ce support' }).click()
  await expect(fondateur.page.locator('li').filter({ hasText: titre }).getByText('Validé par')).toBeVisible({ timeout: 20_000 })
  await fondateur.context.close()

  await beneficiaire.page.goto(`/mon-espace/${beneficiaireId}/revisions`)
  const ligneApresValidation = beneficiaire.page.locator('li').filter({ hasText: titre })
  await expect(ligneApresValidation.getByText('Validé par')).toBeVisible({ timeout: 20_000 })
  await ligneApresValidation.getByRole('button', { name: 'Réviser vite' }).click()
  await ligneApresValidation.getByRole('button', { name: /QCM standard/ }).click()
  await beneficiaire.page.waitForURL(/\/revisions\/quiz\//, { timeout: 30_000 })

  // Répond à toutes les questions (première option à chaque fois) jusqu'à la fin.
  // Depuis le moteur "50 questions minimum" (handoff v3 §T4), même un support court
  // génère largement plus de 10 questions — marge de sécurité au-delà du maximum réel.
  for (let i = 0; i < 60; i++) {
    const boutonSuivant = beneficiaire.page.getByRole('button', { name: /Question suivante|Terminer/ })
    if (!(await boutonSuivant.isVisible().catch(() => false))) break
    const premiereOption = beneficiaire.page.locator('button.w-full.text-left').first()
    if (await premiereOption.isVisible().catch(() => false)) await premiereOption.click()
    const texteBouton = await boutonSuivant.textContent()
    await boutonSuivant.click()
    if (texteBouton?.includes('Terminer')) break
  }

  await expect(beneficiaire.page.getByText('Retour aux révisions')).toBeVisible({ timeout: 20_000 })
  await beneficiaire.context.close()
})
