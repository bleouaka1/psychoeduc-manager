import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/')
}

test('une demande d\'inscription peut être validée puis un bénéficiaire sans historique supprimé', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)
  await page.goto('/solo/beneficiaires')

  const nom = 'E2E'
  const prenoms = `Demande${Date.now()}`
  await page.fill('input[name="nom"]', nom)
  await page.fill('input[name="prenoms"]', prenoms)
  await page.check('input[name="comme_demande"]')
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  const demande = page.locator('div.py-3').filter({ hasText: `${nom} ${prenoms}` })
  await expect(demande).toBeVisible()

  await demande.getByRole('button', { name: 'Valider' }).click()
  await page.waitForLoadState('networkidle')

  await page.goto('/solo/beneficiaires?vue=nouveau')
  const ligne = page.locator('div.py-3').filter({ hasText: `${nom} ${prenoms}` })
  await expect(ligne).toBeVisible()

  await ligne.getByRole('button', { name: 'Supprimer' }).click()
  await page.click('button:has-text("Supprimer définitivement")')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('div.py-3').filter({ hasText: `${nom} ${prenoms}` })).toHaveCount(0)

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('un signalement envoyé sur la fiche bénéficiaire apparaît dans le fil chronologique côté formateur', async ({ page }) => {
  await connecter(page)
  await page.goto('/solo/beneficiaires')

  const nom = 'E2E'
  const prenoms = `Signalement${Date.now()}`
  await page.fill('input[name="nom"]', nom)
  await page.fill('input[name="prenoms"]', prenoms)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  await page.getByRole('link', { name: `${nom} ${prenoms}` }).click()
  await expect(page).toHaveURL(/\/solo\/beneficiaires\/[\w-]+$/, { timeout: 20000 })

  const contenu = `Signalement E2E ${Date.now()}`
  await page.selectOption('select[name="type_message"]', 'signalement')
  await page.fill('input[name="contenu"]', contenu)
  // Nom exact requis : la fiche bénéficiaire porte aussi un bouton "Envoyer un message"
  // (messagerie directe WhatsApp/Email) dont le libellé contient "Envoyer" en sous-chaîne.
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(contenu)).toBeVisible()
  await expect(page.getByText('Signalement', { exact: true })).toBeVisible()
})
