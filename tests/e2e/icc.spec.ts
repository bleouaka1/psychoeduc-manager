import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'
const BENEFICIAIRE_EMAIL = 'e2e-beneficiaire-fixture@psychoeduc-manager.local'
const BENEFICIAIRE_PASSWORD = 'E2eBeneficiaireFixture2026!'

test('le praticien définit des compétences ICC pour une formation et évalue un bénéficiaire (savoirs, savoir-faire, savoir-être)', async ({ page }) => {
  test.setTimeout(90_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/solo', { timeout: 45000 })

  const ts = Date.now()
  const nomFormation = `Formation ICC E2E ${ts}`
  await page.goto('/solo/formations')
  await page.fill('input[name="titre"]', nomFormation)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  const nom = 'E2EIcc'
  const prenoms = `Beneficiaire${ts}`
  await page.goto('/solo/beneficiaires')
  await page.fill('input[name="nom"]', nom)
  await page.fill('input[name="prenoms"]', prenoms)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: `${nom} ${prenoms}` }).click()
  await expect(page).toHaveURL(/\/solo\/beneficiaires\/[\w-]+$/, { timeout: 20000 })

  await page.getByRole('link', { name: 'ICC' }).click()
  await expect(page).toHaveURL(/\/icc$/)
  await page.getByRole('link', { name: nomFormation }).click()
  await expect(page).toHaveURL(/\/icc\?formation=/)

  const panneauSavoirs = page.locator('section', { hasText: 'Savoirs (test avant' })
  const libelleSavoir = `Sait compter E2E ${ts}`
  await panneauSavoirs.locator('input[name="libelle"]').fill(libelleSavoir)
  await panneauSavoirs.getByRole('button', { name: 'Ajouter' }).click()
  await page.waitForLoadState('networkidle')

  const ligneSavoir = page.locator('li').filter({ hasText: libelleSavoir })
  await expect(ligneSavoir).toBeVisible()
  await ligneSavoir.getByRole('button', { name: /Après : Non maîtrisé/ }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('li').filter({ hasText: libelleSavoir }).getByRole('button', { name: /Après : Maîtrisé/ })).toBeVisible()

  const panneauSavoirFaire = page.locator('section', { hasText: 'Savoir-faire (débutant' })
  const libelleSavoirFaire = `Sait manier E2E ${ts}`
  await panneauSavoirFaire.locator('input[name="libelle"]').fill(libelleSavoirFaire)
  await panneauSavoirFaire.getByRole('button', { name: 'Ajouter' }).click()
  await page.waitForLoadState('networkidle')

  const ligneSavoirFaire = page.locator('li').filter({ hasText: libelleSavoirFaire })
  await ligneSavoirFaire.locator('select[name="niveau"]').selectOption('autonome')
  await ligneSavoirFaire.getByRole('button', { name: 'OK' }).click()
  await page.waitForLoadState('networkidle')

  const panneauSavoirEtre = page.locator('section', { hasText: 'Savoir-être (observations' })
  await panneauSavoirEtre.getByRole('button', { name: /Ponctualité/ }).click()
  await page.waitForLoadState('networkidle')
  await expect(panneauSavoirEtre.getByRole('button', { name: /Ponctualité ✓/ })).toBeVisible()

  // Scores affichés : 1/1 savoir maitrise apres = 100, autonome = 75, 1/5 tags = 20.
  await expect(page.getByText('100', { exact: true })).toBeVisible()
  await expect(page.getByText('75', { exact: true })).toBeVisible()
  await expect(page.getByText('20', { exact: true })).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('le bénéficiaire voit son Indice de Compétences (3 sous-scores) sur /mon-espace', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', BENEFICIAIRE_EMAIL)
  await page.fill('#password', BENEFICIAIRE_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/mon-espace\/[\w-]+$/, { timeout: 45000 })

  await expect(page.getByText('Indice de Compétences — Formation ICC Fixture')).toBeVisible()
  await expect(page.getByText('Un bulletin de progression, pas un diplôme certifié.')).toBeVisible()
  // savoir apres=true (1/1) -> 100 ; savoir_faire expert -> 100 ; savoir_etre 1/5 tags -> 20.
  await expect(page.getByText('100', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('20', { exact: true })).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
