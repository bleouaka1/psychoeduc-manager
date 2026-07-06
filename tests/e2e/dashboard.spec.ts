import { test, expect } from '@playwright/test'

const FIXTURE_EMAIL = 'e2e-fixture@psychoeduc-manager.local'
const FIXTURE_PASSWORD = 'E2eFixtureTest2026!'

test('le cockpit fondateur affiche les métriques réelles sans erreur JS (une fois connecté)', async ({ page }) => {
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') erreursConsole.push(msg.text())
  })

  await page.goto('/login')
  await page.fill('#email', FIXTURE_EMAIL)
  await page.fill('#password', FIXTURE_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('http://localhost:3000/')

  const main = page.getByRole('main')
  await expect(page.getByText('Cockpit Fondateur')).toBeVisible()
  await expect(main.getByText('Organisations', { exact: true })).toBeVisible()
  await expect(main.getByText('Bénéficiaires', { exact: true })).toBeVisible()
  await expect(main.getByText('Évaluations IGA', { exact: true })).toBeVisible()
  await expect(main.getByText('Score IGA moyen', { exact: true })).toBeVisible()
  await expect(main.getByText('Licences actives', { exact: true })).toBeVisible()
  await expect(main.getByText('Essais gratuits', { exact: true })).toBeVisible()

  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
