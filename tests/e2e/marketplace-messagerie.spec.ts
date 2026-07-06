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
  await expect(page).toHaveURL('http://localhost:3000/', { timeout: LOGIN_TIMEOUT })
  return { context, page }
}

test('le Fondateur envoie un message au vendeur depuis la fiche détail, le vendeur répond', async ({ browser }) => {
  test.setTimeout(180_000)
  const erreursConsole: string[] = []

  // 1. Le compte Solo soumet une offre fraîche (pour un created_by garanti).
  const solo = await connecter(browser, SOLO_EMAIL, SOLO_PASSWORD)
  solo.page.on('pageerror', (err) => erreursConsole.push(err.message))

  await solo.page.goto('/solo/marketplace')
  const titre = `Produit Messagerie E2E ${Date.now()}`
  await solo.page.selectOption('select[name="type_offre"]', 'produit')
  await solo.page.fill('input[name="titre"]', titre)
  await solo.page.fill('input[name="prix"]', '3500')
  await solo.page.click('button:has-text("Soumettre pour validation")')

  // 2. Le Fondateur envoie un message au sujet de cette offre précise.
  const fondateur = await connecter(browser, FONDATEUR_EMAIL, FONDATEUR_PASSWORD)
  const { page } = fondateur
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/marketplace')
  const ligne = page.locator('tr').filter({ hasText: titre })
  await expect(ligne).toBeVisible({ timeout: 45_000 })
  await ligne.getByRole('link', { name: /Détail/ }).click()
  // Attend que la fiche détail (composant client MessageThread inclus) soit réellement
  // montée avant de remplir son textarea — un clic sur un <Link> Next.js ne garantit pas
  // que la navigation/l'hydratation soit terminée au retour de .click().
  await expect(page.getByRole('heading', { name: titre, level: 3 })).toBeVisible({ timeout: 20_000 })

  const messageFondateur = `Message Fondateur E2E ${Date.now()}`
  const textareaMessage = page.locator('textarea[placeholder*="vendeur au sujet"]')
  const boutonEnvoyer = page.getByRole('button', { name: 'Envoyer', exact: true })
  // `fill()` met parfois à jour le DOM sans que l'état React du contrôlé (`contenu`)
  // ne se synchronise dans la même passe sous cette page dense (bouton resté "disabled" en
  // pratique) : on revérifie et on réessaie plutôt que de cliquer sur un bouton désactivé.
  await expect(async () => {
    await textareaMessage.fill(messageFondateur)
    await expect(boutonEnvoyer).toBeEnabled({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
  await boutonEnvoyer.click()
  // Le bouton passe par "Envoi…" (enCours=true) puis revient à "Envoyer" une fois la Server
  // Action résolue — attendre ce retour avant de vérifier le message, plutôt qu'un getByText
  // page-entière qui peut matcher le contenu encore affiché dans le <textarea> en cas
  // d'échec (contenu non vidé tant que la réponse n'est pas un succès).
  await expect(page.getByRole('button', { name: 'Envoyer', exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('ul li p', { hasText: messageFondateur })).toBeVisible({ timeout: 20_000 })
  await fondateur.context.close()

  // 3. Le vendeur voit le message et y répond depuis /solo/marketplace.
  await solo.page.goto('/solo/marketplace')
  await expect(solo.page.getByText(messageFondateur)).toBeVisible({ timeout: 45_000 })

  const messageVendeur = `Réponse Vendeur E2E ${Date.now()}`
  const filOffre = solo.page.locator('div').filter({ hasText: titre }).filter({ has: solo.page.getByPlaceholder('Répondre au Fondateur…') }).last()
  await filOffre.getByPlaceholder('Répondre au Fondateur…').fill(messageVendeur)
  await filOffre.getByRole('button', { name: /Répondre/ }).click()
  await expect(solo.page.getByText(messageVendeur)).toBeVisible()
  await solo.context.close()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
