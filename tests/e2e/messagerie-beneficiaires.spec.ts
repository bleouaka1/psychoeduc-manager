import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

test('le modal "Envoyer un message" désactive WhatsApp/Email quand un bénéficiaire n\'a aucun contact renseigné, et masque les catégories sans contact', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/solo')

  const nom = 'E2E'
  const prenoms = `MessagerieSansContact${Date.now()}`
  await page.goto('/solo/beneficiaires')
  await page.fill('input[name="nom"]', nom)
  await page.fill('input[name="prenoms"]', prenoms)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  const lien = page.getByRole('link', { name: `${nom} ${prenoms}` })
  await expect(lien).toBeVisible()
  await lien.click()
  await expect(page).toHaveURL(/\/solo\/beneficiaires\/[\w-]+$/, { timeout: 20000 })

  await page.click('button:has-text("Envoyer un message")')
  await expect(page.getByRole('heading', { name: 'Envoyer un message' })).toBeVisible()

  // Bénéficiaire tout juste créé : ni téléphone ni email -> catégorie sélectionnable (c'est le
  // seul contact existant) mais les deux boutons d'envoi doivent être désactivés (rendus comme de
  // vrais <button disabled>, pas des <a> sans href qui perdraient leur rôle accessible "link").
  const boutonWhatsApp = page.getByRole('button', { name: 'WhatsApp' })
  const boutonEmail = page.getByRole('button', { name: 'Email' })
  await expect(boutonWhatsApp).toBeDisabled()
  await expect(boutonEmail).toBeDisabled()
  await expect(boutonWhatsApp).toHaveAttribute('title', 'Aucun contact WhatsApp/Email renseigné')

  // Aucun parent/tuteur ni formateur/responsable affecté à ce bénéficiaire tout juste créé.
  const radioParent = page.locator('input[name="categorie"]').nth(1)
  const radioFormateur = page.locator('input[name="categorie"]').nth(2)
  await expect(radioParent).toBeDisabled()
  await expect(radioFormateur).toBeDisabled()
  await expect(page.getByText('Parent / Tuteur')).toBeVisible()
  await expect(page.getByText('(aucun contact)').first()).toBeVisible()

  await page.click('button:has-text("Fermer")')
  await expect(page.getByRole('heading', { name: 'Envoyer un message' })).toBeHidden()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
