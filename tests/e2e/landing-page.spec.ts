import { test, expect } from '@playwright/test'

test('la page d\'accueil publique se charge sans authentification, sans erreur JS, et ses CTA pointent vers de vraies routes', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/')
  await expect(page).toHaveURL('http://localhost:3000/')
  await expect(page.getByRole('heading', { name: /Chaque parcours d'autonomie mérite d'être vu/ })).toBeVisible()

  // Nav
  await expect(page.getByRole('link', { name: 'Connexion' })).toHaveAttribute('href', '/login')
  await expect(page.getByRole('link', { name: 'Créer un compte' }).first()).toHaveAttribute('href', '/inscription')

  // Sections clés présentes
  await expect(page.getByText('Mesurez votre score IGA')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mesurer mon IGA' })).toHaveAttribute('href', '/mesurer-iga')
  await expect(page.getByText('Vendez vos compétences')).toBeVisible()
  await expect(page.getByText("Fiches d'entretien modulaires")).toBeVisible()
  await expect(page.getByText('Six étapes. Un fil conducteur pour chaque bénéficiaire.')).toBeVisible()
  await expect(page.getByText('Praticien indépendant')).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('les liens Connexion et Créer un compte de la page d\'accueil mènent aux bonnes pages', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Connexion' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/')
  await page.getByRole('link', { name: 'Créer un compte' }).first().click()
  await expect(page).toHaveURL(/\/inscription$/)
})
