import { test, expect, type Browser } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'
const FONDATEUR_EMAIL = 'e2e-fondateur-fixture@psychoeduc-manager.local'
const FONDATEUR_PASSWORD = 'E2eFondateurFixture2026!'
const LOGIN_TIMEOUT = 45_000

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

test('cycle complet cercle d\'apprentissage : création, invitation, acceptation, discussion, signalement, sortie', async ({ browser }) => {
  test.setTimeout(180_000)
  const erreursConsole: string[] = []

  const praticien = await connecter(browser, SOLO_EMAIL, SOLO_PASSWORD)
  const { page } = praticien
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  const ts = Date.now()
  const nomCercle = `Cercle E2E ${ts}`
  await page.goto('/solo/cercles')
  await page.fill('input[name="nom"]', nomCercle)
  await page.fill('input[name="description"]', 'Cercle de test E2E')
  await page.fill('textarea[name="charte"]', 'Respect et bienveillance.')
  await page.click('button:has-text("Créer le cercle")')
  await page.waitForLoadState('networkidle')

  const ligneCercle = page.locator('li').filter({ hasText: nomCercle })
  await expect(ligneCercle).toBeVisible()
  await ligneCercle.click()
  await expect(page).toHaveURL(/\/solo\/cercles\/[\w-]+$/)

  // Invite le dossier bénéficiaire déjà créé par tests/e2e/devenir-beneficiaire.spec.ts
  // (le compte Fondateur devenu bénéficiaire de ce même praticien) — évite de dépendre
  // d'un nouveau compte bénéficiaire activé (email + confirmation) dans ce seul test.
  // Nom fixé une fois sur le profil fixture ("FixtureFondateur E2E") pour rester
  // identifiable sans ambiguïté même si d'autres comptes (ex. l'utilisateur réel)
  // deviennent aussi bénéficiaires de ce même praticien avec un nom générique.
  await page.selectOption('select[name="beneficiaireId"]', { label: 'FixtureFondateur E2E' })
  await page.click('button:has-text("Inviter")')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('li').filter({ hasText: 'FixtureFondateur' }).getByText('Invitation envoyée')).toBeVisible()

  // Le bénéficiaire (compte Fondateur, contexte séparé) accepte l'invitation, discute, signale, quitte.
  const beneficiaire = await connecter(browser, FONDATEUR_EMAIL, FONDATEUR_PASSWORD)
  const pageBeneficiaire = beneficiaire.page
  pageBeneficiaire.on('pageerror', (err) => erreursConsole.push(err.message))

  await pageBeneficiaire.goto('/mon-espace')
  await expect(pageBeneficiaire).toHaveURL(/\/mon-espace\/[\w-]+$/, { timeout: 20000 })
  const dossierId = pageBeneficiaire.url().split('/mon-espace/')[1]
  await pageBeneficiaire.goto(`/mon-espace/${dossierId}/cercles`)

  const ligneInvitation = pageBeneficiaire.locator('li').filter({ hasText: nomCercle })
  await expect(ligneInvitation).toBeVisible()
  await ligneInvitation.getByRole('button', { name: "Accepter l'invitation" }).click()
  await pageBeneficiaire.waitForLoadState('networkidle')

  await pageBeneficiaire.locator('li').filter({ hasText: nomCercle }).getByRole('link', { name: 'Ouvrir la discussion →' }).click()
  await expect(pageBeneficiaire).toHaveURL(/\/cercles\/[\w-]+$/)
  await expect(pageBeneficiaire.getByText('Respect et bienveillance.')).toBeVisible()

  const messageBeneficiaire = `Bonjour a tous E2E ${ts}`
  await pageBeneficiaire.fill('input[name="contenu"]', messageBeneficiaire)
  await pageBeneficiaire.click('button:has-text("Envoyer")')
  await pageBeneficiaire.waitForLoadState('networkidle')
  await pageBeneficiaire.reload()
  await expect(pageBeneficiaire.getByText(messageBeneficiaire)).toBeVisible({ timeout: 15000 })

  await pageBeneficiaire.click('button:has-text("Signaler")')
  await pageBeneficiaire.waitForLoadState('networkidle')

  await pageBeneficiaire.click('button:has-text("Quitter ce cercle")')
  await pageBeneficiaire.waitForLoadState('networkidle')
  await expect(pageBeneficiaire).toHaveURL(/\/cercles$/)
  await beneficiaire.context.close()

  // Le praticien (même contexte que la création) voit le message du bénéficiaire.
  await page.goto('/solo/cercles')
  await page.locator('li').filter({ hasText: nomCercle }).click()
  await expect(page.getByText(messageBeneficiaire)).toBeVisible()
  await praticien.context.close()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
