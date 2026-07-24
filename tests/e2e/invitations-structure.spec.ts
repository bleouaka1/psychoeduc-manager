import { test, expect } from '@playwright/test'

const DIRECTEUR_EMAIL = 'e2e-structure-directeur-fixture@psychoeduc-manager.local'
const DIRECTEUR_PASSWORD = 'E2eStructureDirecteur2026!'
const MEMBRE_EMAIL = 'e2e-invitation-membre-fixture@psychoeduc-manager.local'
const MEMBRE_PASSWORD = 'E2eInvitationMembre2026!'
const PARENT_EMAIL = 'e2e-invitation-parent-fixture@psychoeduc-manager.local'
const PARENT_PASSWORD = 'E2eInvitationParent2026!'
const BENEFICIAIRE_NOM = 'Fixture Assignation'

async function connecter(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  // Destination dépend du rôle/type de compte (Directeur → /dashboard, mais le fixture
  // parent peut déjà avoir un lien actif d'un run précédent et atterrir sur /espace-parent
  // dès la connexion) — on vérifie juste que la connexion a réussi.
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 30000 })
}

// Le formulaire "membre d'équipe" est le seul à porter select[name="role_propose"] ;
// le formulaire "parent/tuteur" est le seul à porter select[name="beneficiaire_id"].
// Le titre du Panel est un <h2> frère du <form>, jamais un texte à l'intérieur du <form>
// lui-même — cibler par structure plutôt que par hasText sur le form.
function formulaireEquipe(page: import('@playwright/test').Page) {
  // Les deux formulaires ont un select[name="role_propose"] (rôle équipe vs Parent/Tuteur) —
  // seul celui de l'équipe n'a PAS de select[name="beneficiaire_id"].
  return page.locator('form').filter({ has: page.locator('select[name="role_propose"]') }).filter({ hasNot: page.locator('select[name="beneficiaire_id"]') })
}
function formulaireParent(page: import('@playwright/test').Page) {
  return page.locator('form').filter({ has: page.locator('select[name="beneficiaire_id"]') })
}

/** Extrait le token depuis le href "Ouvrir le lien" de la ligne d'invitation correspondant à l'email donné. */
async function extraireTokenInvitation(page: import('@playwright/test').Page, email: string): Promise<string> {
  const ligne = page.locator('tr').filter({ hasText: email }).filter({ hasText: 'En attente' }).first()
  const href = await ligne.getByRole('link', { name: 'Ouvrir le lien' }).getAttribute('href')
  const token = new URL(href ?? '', 'http://localhost:3000').searchParams.get('token')
  if (!token) throw new Error(`Token introuvable pour ${email}`)
  return token
}

test('un membre d\'équipe déjà inscrit peut accepter une invitation Directeur, et le lien devient invalide une fois utilisé', async ({ page, browser }) => {
  test.setTimeout(90_000)
  const erreursConsole: string[] = []
  page.on('pageerror', (err) => erreursConsole.push(err.message))

  await connecter(page, DIRECTEUR_EMAIL, DIRECTEUR_PASSWORD)
  await page.goto('/invitations')
  await expect(page.getByText("Inviter un membre d'équipe")).toBeVisible()

  await formulaireEquipe(page).locator('input[name="email"]').fill(MEMBRE_EMAIL)
  await formulaireEquipe(page).locator('select[name="role_propose"]').selectOption('coordinateur')
  await formulaireEquipe(page).getByRole('button', { name: 'Inviter' }).click()
  await page.waitForLoadState('networkidle')

  const token = await extraireTokenInvitation(page, MEMBRE_EMAIL)

  const contexteMembre = await browser.newContext()
  const pageMembre = await contexteMembre.newPage()
  await connecter(pageMembre, MEMBRE_EMAIL, MEMBRE_PASSWORD)
  await pageMembre.goto(`/invitation?token=${token}`)
  await expect(pageMembre.getByText(/Rejoindre/)).toBeVisible()
  await pageMembre.click('button:has-text("Accepter l\'invitation")')
  await expect(pageMembre).toHaveURL('http://localhost:3000/dashboard', { timeout: 20000 })

  // Le lien, maintenant consommé, redevient invalide (idempotence/sécurité — un même
  // lien ne peut pas être réutilisé pour rejoindre une deuxième fois).
  await pageMembre.goto(`/invitation?token=${token}`)
  await expect(pageMembre.getByText('Lien invalide ou expiré')).toBeVisible()

  await contexteMembre.close()
  expect(erreursConsole, `Erreurs JS inattendues: ${erreursConsole.join('\n')}`).toEqual([])
})

test('un parent déjà inscrit peut accepter une invitation liée à un bénéficiaire précis', async ({ page, browser }) => {
  test.setTimeout(90_000)

  await connecter(page, DIRECTEUR_EMAIL, DIRECTEUR_PASSWORD)
  await page.goto('/invitations')
  await expect(page.getByText('Inviter un parent / tuteur')).toBeVisible()

  await formulaireParent(page).locator('input[name="email"]').fill(PARENT_EMAIL)
  await formulaireParent(page).locator('select[name="beneficiaire_id"]').selectOption({ label: BENEFICIAIRE_NOM })
  await formulaireParent(page).getByRole('button', { name: 'Inviter' }).click()
  await page.waitForLoadState('networkidle')

  const token = await extraireTokenInvitation(page, PARENT_EMAIL)

  const contexteParent = await browser.newContext()
  const pageParent = await contexteParent.newPage()
  await connecter(pageParent, PARENT_EMAIL, PARENT_PASSWORD)
  await pageParent.goto(`/invitation?token=${token}`)
  await expect(pageParent.getByText(new RegExp(BENEFICIAIRE_NOM.split(' ')[1]))).toBeVisible()
  await pageParent.click('button:has-text("Accepter l\'invitation")')
  await expect(pageParent).toHaveURL('http://localhost:3000/espace-parent', { timeout: 20000 })

  await pageParent.goto(`/invitation?token=${token}`)
  await expect(pageParent.getByText('Lien invalide ou expiré')).toBeVisible()

  await contexteParent.close()
})
