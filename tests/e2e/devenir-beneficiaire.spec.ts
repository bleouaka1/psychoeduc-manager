import { test, expect } from '@playwright/test'

const FONDATEUR_EMAIL = 'e2e-fondateur-fixture@psychoeduc-manager.local'
const FONDATEUR_PASSWORD = 'E2eFondateurFixture2026!'

test('un compte Fondateur peut devenir bénéficiaire d\'un autre praticien depuis son propre tableau de bord (comptes multiprofils)', async ({ page }) => {
  test.setTimeout(60_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', FONDATEUR_EMAIL)
  await page.fill('#password', FONDATEUR_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 45000 })

  // Point d'entrée visible depuis le tableau de bord (Sidebar Fondateur).
  await page.goto('/dashboard')
  await page.getByRole('link', { name: 'Devenir bénéficiaire' }).click()
  await expect(page).toHaveURL(/\/devenir-beneficiaire$/)
  await expect(page.getByRole('heading', { name: 'Devenir bénéficiaire' })).toBeVisible()

  await page.fill('input[name="q"]', 'E2E Solo Fixture')
  await page.press('input[name="q"]', 'Enter')
  await page.waitForLoadState('networkidle')

  const ligneFormateur = page.locator('li').filter({ hasText: 'E2E Solo Fixture' })
  await expect(ligneFormateur).toBeVisible()
  await ligneFormateur.getByRole('button', { name: 'Devenir bénéficiaire ici' }).click()
  await page.waitForLoadState('networkidle')

  // Ce test réutilise le compte fixture Fondateur d'une exécution à l'autre de la suite :
  // un dossier peut déjà exister auprès de ce même praticien depuis un run précédent, auquel
  // cas l'action est un no-op silencieux (idempotent) et la page reste sur /devenir-beneficiaire
  // plutôt que de rediriger vers un nouveau /mon-espace/[id] — les deux issues sont valides ici.
  if (/\/mon-espace\//.test(page.url())) {
    await expect(page.getByText("Boussole d'Autonomie")).toBeVisible()
  } else {
    await expect(page).toHaveURL(/\/devenir-beneficiaire/)
  }

  // Idempotent, dans tous les cas : retenter depuis la page de recherche ne doit jamais
  // créer un deuxième dossier ni rediriger vers un nouveau /mon-espace/[id].
  await page.goto('/devenir-beneficiaire?q=E2E+Solo+Fixture')
  await page.locator('li').filter({ hasText: 'E2E Solo Fixture' }).getByRole('button', { name: 'Devenir bénéficiaire ici' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/devenir-beneficiaire/)

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
