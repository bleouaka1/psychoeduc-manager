import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

test('un compte Solo peut ajouter un bénéficiaire, lui définir un jalon, le faire progresser, lui envoyer un message et ouvrir son rapport de bilan', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/solo')

  const nom = 'E2E'
  const prenoms = `Beneficiaire${Date.now()}`
  await page.goto('/solo/beneficiaires')
  await page.fill('input[name="nom"]', nom)
  await page.fill('input[name="prenoms"]', prenoms)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  const lien = page.getByRole('link', { name: `${nom} ${prenoms}` })
  await expect(lien).toBeVisible()
  await lien.click()
  // premier accès à cette route dynamique : compilation Turbopack à froid, plus longue que le défaut
  await expect(page).toHaveURL(/\/solo\/beneficiaires\/[\w-]+$/, { timeout: 20000 })

  // Scopé au panneau Objectifs : la fiche bénéficiaire porte aussi un panneau
  // "Projets de vie" avec son propre input[name="titre"].
  const panneauObjectifs = page.locator('section', { hasText: 'Objectifs & jalons' })
  const titreObjectif = `Objectif E2E ${Date.now()}`
  await panneauObjectifs.locator('input[name="titre"]').fill(titreObjectif)
  await panneauObjectifs.getByRole('button', { name: 'Ajouter' }).click()
  await page.waitForLoadState('networkidle')

  const objectif = page.locator('li').filter({ hasText: titreObjectif })
  await expect(objectif).toBeVisible()
  await expect(objectif.getByText('À venir')).toBeVisible()

  await objectif.getByRole('button', { name: 'Démarrer' }).click()
  await page.waitForLoadState('networkidle')
  await expect(objectif.getByText('En cours')).toBeVisible()

  await objectif.getByRole('button', { name: 'Marquer atteint' }).click()
  await page.waitForLoadState('networkidle')
  await expect(objectif.getByText('Atteint')).toBeVisible()

  const contenuMessage = `Message E2E ${Date.now()}`
  await page.fill('input[name="contenu"]', contenuMessage)
  // Nom exact requis : la fiche bénéficiaire porte aussi un bouton "Envoyer un message"
  // (messagerie directe WhatsApp/Email) dont le libellé contient "Envoyer" en sous-chaîne.
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(contenuMessage)).toBeVisible()

  const [rapportPage] = await Promise.all([page.waitForEvent('popup'), page.click('text=Rapport de bilan')])
  await rapportPage.waitForLoadState('networkidle')
  await expect(rapportPage.getByText(`Rapport de bilan — ${nom} ${prenoms}`)).toBeVisible()
  await expect(rapportPage.getByText(titreObjectif)).toBeVisible()
  await rapportPage.close()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
