import { test, expect } from '@playwright/test'

const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

test('badge, page détail, profil formateur et contact fonctionnent de bout en bout', async ({ page }) => {
  test.setTimeout(240_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/', { timeout: 45000 })

  await page.goto('/solo/formations')
  const titre = `Formation Badge E2E ${Date.now()}`
  await page.fill('input[name="titre"]', titre)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  // le badge apparaît immédiatement côté formateur, sur sa propre fiche formation
  const carteFormation = page.locator('div.py-4').filter({ hasText: titre })
  await expect(carteFormation.getByText('NOUVEAU · EN VÉRIFICATION')).toBeVisible({ timeout: 15000 })

  // la marketplace publique (/solo/marketplace) exclut délibérément les offres de SA
  // PROPRE organisation (comportement "découvrir d'autres vendeurs", vérifié ailleurs) :
  // on récupère donc l'id de la formation via le lien "Modifier" pour aller directement
  // sur sa page détail, comme le ferait un acheteur externe cliquant depuis son navigateur.
  const hrefModifier = await carteFormation.getByRole('link', { name: 'Modifier' }).getAttribute('href')
  const formationId = new URL(hrefModifier ?? '', 'http://localhost:3000').searchParams.get('edit')
  await page.goto(`/solo/marketplace/formation/${formationId}`)
  await expect(page.getByText('NOUVEAU · EN VÉRIFICATION')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Formateur', { exact: true })).toBeVisible({ timeout: 15000 })

  // profil formateur complet
  await page.click('text=Voir le profil complet')
  await expect(page).toHaveURL(/\/solo\/marketplace\/formateur\/[\w-]+$/, { timeout: 45000 })
  await expect(page.getByText('Bénéficiaires accompagnés')).toBeVisible({ timeout: 15000 })

  // contact via la messagerie interne
  await page.click('button:has-text("Contacter")')
  const messageContact = `Message contact E2E ${Date.now()}`
  await page.fill('textarea[name="contenu"]', messageContact)
  await page.click('button:has-text("Envoyer")')
  await expect(page.getByText('Message envoyé.')).toBeVisible({ timeout: 20000 })

  // nettoyage
  await page.goto('/solo/formations')
  const carte = page.locator('div.py-4').filter({ hasText: titre })
  await carte.getByRole('button', { name: 'Supprimer' }).click()
  await page.click('button:has-text("Supprimer définitivement")')
  await page.waitForLoadState('networkidle')

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('le profil solo peut enregistrer bio, spécialités et CV structuré', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/', { timeout: 45000 })

  await page.goto('/solo/profil')
  const cvTexte = `Expérience E2E ${Date.now()}`
  await page.fill('textarea[name="cv_texte"]', cvTexte)
  await page.click('button:has-text("Enregistrer")')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(cvTexte)).toBeVisible({ timeout: 20000 })
})
