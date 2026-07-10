import { test, expect } from '@playwright/test'

test('la finalisation d\'inscription différée (confirmation e-mail) crée l\'organisation à la première connexion', async ({ page }) => {
  // Fixture créée directement en base (raw_user_meta_data type_organisation/organisation_nom,
  // aucune organisation encore associée) — simule un utilisateur qui vient de confirmer son
  // e-mail après signUp() mais dont l'organisation n'a pas encore pu être créée (RLS exige un
  // contexte authentifié, indisponible avant la confirmation). finaliserOrganisationEnAttente()
  // doit la créer au premier login, puis rediriger vers /solo. Idempotent : rejouable sans
  // effet de bord si l'organisation existe déjà (runs suivants).
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/login')
  await page.fill('#email', 'e2e-inscription-pending@psychoeduc-manager.local')
  await page.fill('#password', 'E2eInscriptionPending2026!')
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL('http://localhost:3000/solo')
  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('le formulaire d\'inscription valide les champs requis avant tout appel réseau', async ({ page }) => {
  await page.goto('/inscription')
  await page.click('button[type="submit"]')
  // Les champs HTML `required` empêchent la soumission tant qu'ils sont vides —
  // on reste sur /inscription, aucune erreur serveur n'a pu être déclenchée.
  await expect(page).toHaveURL(/\/inscription$/)
})

test('le formulaire d\'inscription accepte une saisie et affiche un état de suite cohérent (confirmation ou message d\'erreur, jamais un crash)', async ({ page }) => {
  // N'affirme pas l'issue exacte (dépend de la configuration e-mail/quota du projet Supabase,
  // hors du contrôle du code applicatif — cf. DECISIONS_LOG.md) : vérifie seulement que le
  // formulaire réagit proprement, sans page blanche ni erreur JS.
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await page.goto('/inscription?type=solo')
  await expect(page.locator('input[name="type_organisation"][value="solo"]')).toBeChecked()

  await page.fill('#organisation_nom', `Praticien E2E ${Date.now()}`)
  await page.fill('#email', `e2e-inscription-${Date.now()}@example.com`)
  await page.fill('#password', 'E2eInscription2026!')
  await page.click('button[type="submit"]')

  await expect(page.getByText(/Vérifiez votre boîte mail|Impossible de créer le compte|compte existe déjà/)).toBeVisible({ timeout: 20000 })
  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})
