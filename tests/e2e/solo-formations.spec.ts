import { test, expect } from '@playwright/test'

// Compte de test dédié de type Solo, sans lien avec un vrai utilisateur.
const SOLO_EMAIL = 'e2e-solo-fixture@psychoeduc-manager.local'
const SOLO_PASSWORD = 'E2eSoloFixture2026!'

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', SOLO_EMAIL)
  await page.fill('#password', SOLO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/solo')
}

// Les fiches formation sont les seuls éléments de classe "py-4" de la page : scoper
// dessus évite qu'un div ancêtre (qui "contient" aussi le texte) ne soit sélectionné à la place.
function carteFormation(page: import('@playwright/test').Page, titre: string) {
  return page.locator('div.py-4').filter({ hasText: titre })
}

test('un compte Solo peut créer, publier, suspendre puis archiver une formation', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page)

  // le contexte switcher doit rediriger vers l'espace solo (pas de bouton "Cockpit Fondateur" : ce compte n'est pas fondateur)
  await page.goto('/solo')
  await expect(page.getByText('Tableau de bord')).toBeVisible()
  await expect(page.getByText('Cockpit Fondateur')).not.toBeVisible()

  await page.goto('/solo/formations')
  const titre = `Formation E2E ${Date.now()}`
  await page.fill('input[name="titre"]', titre)
  await page.fill('textarea[name="description"]', 'Description de test end-to-end.')
  await page.fill('input[name="duree_texte"]', '2 heures')
  await page.selectOption('select[name="mode_transmission"]', 'presentiel')
  await page.fill('input[name="prix"]', '5000')
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  const carte = carteFormation(page, titre)
  await expect(carte).toBeVisible()
  await expect(carte.getByText('Brouillon')).toBeVisible()

  await carte.getByRole('button', { name: 'Publier' }).click()
  await page.waitForLoadState('networkidle')
  await expect(carte.getByText('Publiée')).toBeVisible()

  await carte.getByRole('button', { name: 'Suspendre' }).click()
  await page.waitForLoadState('networkidle')
  await expect(carte.getByText('Suspendue')).toBeVisible()

  await carte.getByRole('button', { name: 'Archiver' }).click()
  await page.waitForLoadState('networkidle')
  await expect(carte.getByText('Archivée')).toBeVisible()
  await expect(carte.getByRole('button', { name: 'Publier' })).toHaveCount(0)
  await expect(carte.getByRole('button', { name: 'Archiver' })).toHaveCount(0)

  // nettoyage : supprime la formation de test (aucune inscription dessus) pour ne pas polluer les runs suivants
  await carte.getByRole('button', { name: 'Supprimer' }).click()
  await page.click('button:has-text("Supprimer définitivement")')
  await page.waitForLoadState('networkidle')
  await expect(carteFormation(page, titre)).toHaveCount(0)

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('un compte Solo peut modifier puis supprimer définitivement une formation sans inscription', async ({ page }) => {
  await connecter(page)

  await page.goto('/solo/formations')
  const titre = `Formation E2E Edit ${Date.now()}`
  await page.fill('input[name="titre"]', titre)
  await page.click('button:has-text("Ajouter")')
  await page.waitForLoadState('networkidle')

  const carte = carteFormation(page, titre)
  await expect(carte).toBeVisible()
  await carte.getByRole('link', { name: 'Modifier' }).click()
  await expect(page.getByText(`Modifier « ${titre} »`)).toBeVisible()

  const titreModifie = `${titre} (modifiée)`
  await page.fill('input[name="titre"]', titreModifie)
  await page.click('button:has-text("Enregistrer les modifications")')
  await page.waitForLoadState('networkidle')

  const carteModifiee = carteFormation(page, titreModifie)
  await expect(carteModifiee).toBeVisible()

  await carteModifiee.getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('Supprimer cette formation ?')).toBeVisible()
  await page.click('button:has-text("Supprimer définitivement")')
  await page.waitForLoadState('networkidle')
  await expect(carteFormation(page, titreModifie)).toHaveCount(0)
})
