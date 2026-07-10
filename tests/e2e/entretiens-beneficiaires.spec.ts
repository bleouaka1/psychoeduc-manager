import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/solo')
}

async function creerBeneficiaire(page: import('@playwright/test').Page, prenoms: string) {
  await page.goto('/solo/beneficiaires')
  await page.fill('input[name="nom"]', 'E2E')
  await page.fill('input[name="prenoms"]', prenoms)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  const lien = page.getByRole('link', { name: `E2E ${prenoms}` })
  await expect(lien).toBeVisible()
  await lien.click()
  await expect(page).toHaveURL(/\/solo\/beneficiaires\/[\w-]+$/, { timeout: 20000 })
  return page.url()
}

test('un entretien général peut être créé en brouillon puis validé et apparaît dans la timeline', async ({ page }) => {
  // Plusieurs allers-retours serveur (création bénéficiaire, création entretien, 2 sauvegardes,
  // 2 navigations) : le défaut 30s est trop juste sous la latence partagée du projet (cf. navigation.spec.ts).
  test.setTimeout(120_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)
  const urlFiche = await creerBeneficiaire(page, `General${Date.now()}`)

  await page.click('button[name="type_entretien"][value="general"]')
  await expect(page).toHaveURL(/\/entretiens\/[\w-]+$/, { timeout: 20000 })

  const synthese = `Synthèse E2E ${Date.now()}`
  // Ciblage robuste par le textarea précédé du libellé "Synthèse générale"
  await page.locator('label:has-text("Synthèse générale") + textarea').fill(synthese)

  await page.click('button:has-text("Enregistrer le brouillon")')
  await expect(page.getByText('Brouillon enregistré.')).toBeVisible()

  await page.goto(urlFiche)
  await expect(page.getByText(/Entretien Général — /)).toBeVisible()
  await expect(page.getByText('Brouillon', { exact: true }).first()).toBeVisible()

  await page.getByText(/Entretien Général — /).click()
  await expect(page).toHaveURL(/\/entretiens\/[\w-]+$/, { timeout: 20000 })

  page.once('dialog', (dialog) => dialog.accept())
  await page.click('button:has-text("Valider l\'entretien")')
  await expect(page.getByText('Entretien validé.')).toBeVisible()
  await expect(page.getByText('Validé', { exact: true }).first()).toBeVisible()

  await page.goto(urlFiche)
  await expect(page.getByText(/Entretien Général validé/)).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('un entretien spécialisé permet de sélectionner des comportements presets et un comportement libre', async ({ page }) => {
  test.setTimeout(120_000)
  await connecter(page)
  const urlFiche = await creerBeneficiaire(page, `Specialise${Date.now()}`)

  await page.click('button[name="type_entretien"][value="specialise"]')
  await expect(page).toHaveURL(/\/entretiens\/[\w-]+$/, { timeout: 20000 })

  await page.click('button:has-text("Agitation / difficulté à rester assis")')
  await page.click('button:has-text("Retrait social / isolement")')

  const comportementLibre = `Comportement libre E2E ${Date.now()}`
  await page.fill('input[placeholder="Décrire un comportement observé…"]', comportementLibre)
  await page.click('button:has-text("Ajouter")')
  await expect(page.getByText(`${comportementLibre} ×`)).toBeVisible()

  await page.click('button:has-text("Enregistrer le brouillon")')
  await expect(page.getByText('Brouillon enregistré.')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.click('button:has-text("Valider l\'entretien")')
  await expect(page.getByText('Entretien validé.')).toBeVisible()

  await page.goto(urlFiche)
  await expect(page.getByText(/Entretien Spécialisé validé/)).toBeVisible()
})
