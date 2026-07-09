import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'
const FONDATEUR_EMAIL = 'e2e-fondateur-fixture@psychoeduc-manager.local'
const FONDATEUR_PASSWORD = 'E2eFondateurFixture2026!'
const LOGIN_TIMEOUT = 40_000

async function connecter(browser: import('@playwright/test').Browser, email: string, password: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  // Solo et Fondateur atterrissent sur des routes différentes après connexion
  // (/solo, /dashboard…) — on attend juste la sortie de /login, pas une URL exacte.
  await expect(page).not.toHaveURL(/\/login$/, { timeout: LOGIN_TIMEOUT })
  return { context, page }
}

test('cycle complet messagerie interne : ouverture depuis la fiche bénéficiaire, demande de pièce, réponse avec pièce jointe, statut mis à jour', async ({ browser }) => {
  test.setTimeout(180_000)
  const erreursConsole: string[] = []

  const solo = await connecter(browser, SOLO_EMAIL, SOLO_PASSWORD)
  solo.page.on('pageerror', (err) => erreursConsole.push(err.message))

  const nom = 'E2E'
  const prenoms = `MsgInterne${Date.now()}`
  await solo.page.goto('/solo/beneficiaires')
  await solo.page.fill('input[name="nom"]', nom)
  await solo.page.fill('input[name="prenoms"]', prenoms)
  await solo.page.click('button:has-text("Ajouter")')
  await solo.page.waitForLoadState('networkidle')

  await solo.page.getByRole('link', { name: `${nom} ${prenoms}` }).click()
  await expect(solo.page).toHaveURL(/\/solo\/beneficiaires\/[\w-]+$/, { timeout: 20000 })

  await solo.page.click('button:has-text("Messagerie interne")')
  await expect(solo.page).toHaveURL(/\/solo\/messagerie\?conversation=/, { timeout: 20000 })
  const conversationId = new URL(solo.page.url()).searchParams.get('conversation')
  await solo.context.close()

  // Le Fondateur retrouve la même conversation (créée avec lui automatiquement) et demande une pièce.
  const fondateur = await connecter(browser, FONDATEUR_EMAIL, FONDATEUR_PASSWORD)
  fondateur.page.on('pageerror', (err) => erreursConsole.push(err.message))

  await fondateur.page.goto('/messagerie')
  await fondateur.page.getByText(`${prenoms} ${nom}`, { exact: false }).first().click()
  await expect(fondateur.page.getByRole('button', { name: 'Demander une pièce' })).toBeVisible({ timeout: 15000 })
  await fondateur.page.click('button:has-text("Demander une pièce")')
  await fondateur.page.click('button:has-text("Envoyer la demande")')
  await expect(fondateur.page.getByText('Pièce demandée')).toBeVisible({ timeout: 15000 })
  await expect(fondateur.page.getByText('En attente')).toBeVisible()
  await fondateur.context.close()

  // Le Solo répond avec une pièce jointe -> la demande passe à "Reçue".
  const solo2 = await connecter(browser, SOLO_EMAIL, SOLO_PASSWORD)
  solo2.page.on('pageerror', (err) => erreursConsole.push(err.message))

  await solo2.page.goto(`/solo/messagerie?conversation=${conversationId}`)
  await expect(solo2.page.getByText('Pièce demandée')).toBeVisible({ timeout: 20000 })

  await solo2.page.setInputFiles('input[type="file"]', {
    name: 'justificatif.png',
    mimeType: 'image/png',
    buffer: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108020000009077', 'hex'),
  })
  await expect(solo2.page.getByText('Reçue')).toBeVisible({ timeout: 20000 })
  await solo2.context.close()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
