import { test, expect } from '@playwright/test'

const DIRECTEUR_EMAIL = 'e2e-structure-directeur-fixture@psychoeduc-manager.local'
const DIRECTEUR_PASSWORD = 'E2eStructureDirecteur2026!'
const BENEFICIAIRE_NOM = 'Fixture Assignation'

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', DIRECTEUR_EMAIL)
  await page.fill('#password', DIRECTEUR_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/dashboard', { timeout: 30000 })
}

test('un Directeur crée un paiement de scolarité, l\'apure par deux versements append-only, puis génère une facture', async ({ page }) => {
  test.setTimeout(120_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)

  // 1. Créer un paiement de scolarité timestampé (période unique pour ne pas collisionner
  // avec un run précédent sur le même bénéficiaire fixture).
  await page.goto('/paiements')
  const periode = `E2E ${Date.now()}`
  await page.selectOption('select[name="beneficiaire_id"]', { label: BENEFICIAIRE_NOM })
  await page.selectOption('select[name="type_paiement"]', 'scolarite')
  await page.fill('input[name="montant_du"]', '100')
  await page.fill('input[name="periode"]', periode)
  await page.click('button:has-text("Créer")')
  await page.waitForLoadState('networkidle')

  const lignePaiement = page.locator('li').filter({ hasText: periode })
  await expect(lignePaiement).toBeVisible()
  await expect(lignePaiement.getByText('Retard')).toBeVisible()

  // 2. Premier versement partiel (60/100) : statut passe à "Partiel", le formulaire de
  // versement reste visible pour compléter.
  await lignePaiement.locator('input[name="montant"]').fill('60')
  await lignePaiement.locator('button:has-text("Verser")').click()
  await page.waitForLoadState('networkidle')

  const lignePaiementApres1erVersement = page.locator('li').filter({ hasText: periode })
  await expect(lignePaiementApres1erVersement.getByText('Partiel')).toBeVisible()
  await expect(lignePaiementApres1erVersement.getByText('60')).toBeVisible()

  // 3. Second versement solde le paiement (100/100) : statut "À jour", plus de formulaire
  // de versement (le trigger recalculer_paiement_scolarite a bien recalculé depuis
  // versements_scolarite, pas depuis une simple incrémentation applicative).
  await lignePaiementApres1erVersement.locator('input[name="montant"]').fill('40')
  await lignePaiementApres1erVersement.locator('button:has-text("Verser")').click()
  await page.waitForLoadState('networkidle')

  const lignePaiementFinale = page.locator('li').filter({ hasText: periode })
  await expect(lignePaiementFinale.getByText('À jour')).toBeVisible()
  await expect(lignePaiementFinale.locator('button:has-text("Verser")')).toHaveCount(0)

  // 4. Générer une facture pour ce paiement désormais soldé.
  await page.goto('/factures')
  const ligneAFacturer = page.locator('li').filter({ hasText: periode })
  await expect(ligneAFacturer).toBeVisible()
  await ligneAFacturer.getByRole('button', { name: 'Générer' }).click()
  await page.waitForLoadState('networkidle')

  // La facture générée est la plus récente (liste triée par created_at desc) — un getByText
  // non scopé matcherait aussi les factures FA-* d'un précédent run sur ce même fixture.
  await expect(page.locator('li').first().getByText(/^FA-\d{4}-\d{4}$/)).toBeVisible()
  // Une fois facturé, le paiement disparaît de la liste "à facturer".
  await expect(page.locator('li').filter({ hasText: periode }).getByRole('button', { name: 'Générer' })).toHaveCount(0)

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
