import { test, expect } from '@playwright/test'

const DIRECTEUR_EMAIL = 'e2e-structure-directeur-fixture@psychoeduc-manager.local'
const DIRECTEUR_PASSWORD = 'E2eStructureDirecteur2026!'

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', DIRECTEUR_EMAIL)
  await page.fill('#password', DIRECTEUR_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/dashboard', { timeout: 30000 })
}

test('un Directeur cumulant le rôle Promoteur rattache deux établissements, les gère (fermer/réactiver), et voit le réseau apparaître au tableau de bord', async ({ page }) => {
  test.setTimeout(120_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)
  await page.goto('/etablissements')

  // 1. Rattacher deux établissements timestampés (§1 : le sélecteur/réseau multi-établissements
  // ne doit apparaître qu'à partir de 2 établissements actifs).
  const suffixe = Date.now()
  const nomA = `Site Nord ${suffixe}`
  const nomB = `Site Sud ${suffixe}`

  for (const nom of [nomA, nomB]) {
    await page.fill('input[name="nom"]', nom)
    await page.fill('input[name="adresse"]', 'Adresse E2E')
    await page.click('button:has-text("Ajouter")')
    await page.waitForLoadState('networkidle')
  }

  const ligneA = page.locator('li').filter({ hasText: nomA })
  const ligneB = page.locator('li').filter({ hasText: nomB })
  await expect(ligneA).toBeVisible()
  await expect(ligneB).toBeVisible()
  await expect(ligneA.getByText('Actif', { exact: true })).toBeVisible()

  // 2. Fermer puis réactiver le premier — jamais de suppression physique (§4.6/§7.4).
  await ligneA.getByRole('button', { name: 'Fermer' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('li').filter({ hasText: nomA }).getByText('Fermé', { exact: true })).toBeVisible()

  await page.locator('li').filter({ hasText: nomA }).getByRole('button', { name: 'Réactiver' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('li').filter({ hasText: nomA }).getByText('Actif', { exact: true })).toBeVisible()

  // 3. Le réseau d'établissements apparaît maintenant au tableau de bord (rôle Promoteur +
  // plus d'un établissement actif) et liste bien les deux sites créés.
  await page.goto('/dashboard')
  await expect(page.getByText('Réseau d\'établissements')).toBeVisible()
  await expect(page.getByRole('link', { name: nomA })).toBeVisible()
  await expect(page.getByRole('link', { name: nomB })).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
