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

test('un Directeur consulte un journal d\'audit lisible (pas de nom de table brut) et le rapport d\'impact agrégé (aucun nom de bénéficiaire)', async ({ page }) => {
  test.setTimeout(120_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)

  // 1. Générer au moins une entrée d'audit récente et vérifiable (création d'une classe).
  await page.goto('/presences')
  const nomClasse = `Classe Audit E2E ${Date.now()}`
  await page.fill('input[name="nom"]', nomClasse)
  await page.click('button:has-text("Créer")')
  await page.waitForLoadState('networkidle')

  // 2. Le journal d'audit affiche une phrase lisible ("a créé une classe/cohorte"), jamais le
  // nom de table Postgres brut ("classes_groupes") ni un verbe SQL nu ("INSERT") seul en colonne.
  await page.goto('/audit')
  await expect(page.getByText('a créé une classe/cohorte').first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Table' })).toHaveCount(0)

  // 3. Le rapport d'impact affiche des métriques agrégées, jamais un nom de bénéficiaire réel
  // (Fixture Assignation, présent dans l'organisation fixture et donc probablement dans les
  // séries de présences/évaluations agrégées).
  await page.goto('/rapport-impact')
  await expect(page.getByText('Score IGA moyen')).toBeVisible()
  await expect(page.getByText('Taux de présence')).toBeVisible()
  await expect(page.getByText('Taux d\'insertion')).toBeVisible()
  await expect(page.getByText('Fixture Assignation')).toHaveCount(0)

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
