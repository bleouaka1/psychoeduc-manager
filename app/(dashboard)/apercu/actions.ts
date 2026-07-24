'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { COOKIE_APERCU, COOKIE_BACKUP_SESSION } from '@/lib/apercu'

const DESTINATION_PAR_TYPE: Record<string, string> = {
  solo: '/solo',
  employeur: '/employeur',
}

/** Active le mode Aperçu pour l'organisation choisie puis redirige directement vers son
 * tableau de bord — Solo/Employeur ont leur propre console, tout le reste (Structure)
 * passe par le Cockpit générique (`/dashboard`), même logique que `resoudreDestinationConnexion`. */
export async function activerApercuEtRedirection(formData: FormData): Promise<void> {
  const organisationId = String(formData.get('organisation_id') ?? '')
  if (!organisationId) return

  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) return

  const { data: organisation } = await supabase.from('organisations').select('type_organisation').eq('id', organisationId).single()
  if (!organisation) return

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_APERCU, organisationId, { httpOnly: true, sameSite: 'lax', path: '/' })

  redirect(DESTINATION_PAR_TYPE[organisation.type_organisation] ?? '/dashboard')
}

export async function quitterApercuAction(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_APERCU)
  redirect('/apercu')
}

/**
 * Impersonation réelle (pas un simple changement de contexte de lecture comme l'aperçu
 * organisation ci-dessus) : nécessaire pour Espace Parent et Mon Espace bénéficiaire, tous
 * deux scopés directement par `auth.uid()` (RLS `profile_id = auth.uid()` / `parent_profile_id
 * = auth.uid()`) — is_fondateur() ne les contourne PAS (jamais voulu : §3/§7.4 du document
 * Compte Structure interdit explicitement toute élévation de privilège sur ces données).
 * Mécanisme : génère un lien magique via la clé service_role (`lib/supabase/admin.ts`),
 * l'échange contre une vraie session pour ce profil précis, en sauvegardant d'abord la
 * session réelle du Fondateur (cookie httpOnly, 1h) pour pouvoir la restaurer ensuite.
 */
export async function demarrerImpersonation(profileId: string, destination: string): Promise<void> {
  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) return

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return

  const { data: profil } = await supabase.from('profiles').select('email').eq('id', profileId).single()
  if (!profil?.email) return

  // redirect() lève une exception interne (NEXT_REDIRECT) pour interrompre le rendu — ne
  // jamais l'appeler à l'intérieur du try ci-dessous, le catch générique l'avalerait et
  // afficherait toujours "service_role_manquante" même pour une tout autre erreur.
  let hashedToken: string | null = null
  let erreurCle = false
  try {
    const admin = createAdminClient()
    const { data: lien, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: profil.email })
    if (!error && lien?.properties?.hashed_token) hashedToken = lien.properties.hashed_token
  } catch {
    erreurCle = true
  }

  if (erreurCle) redirect('/apercu?erreur=service_role_manquante')
  if (!hashedToken) redirect('/apercu?erreur=lien_impersonation_echoue')

  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: hashedToken, type: 'magiclink' })
  if (verifyError) redirect('/apercu?erreur=lien_impersonation_echoue')

  const cookieStore = await cookies()
  cookieStore.set(
    COOKIE_BACKUP_SESSION,
    JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }),
    { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600 },
  )

  redirect(destination)
}

/** Restaure la session réelle du Fondateur sauvegardée par demarrerImpersonation() —
 * jamais besoin de se reconnecter. Si le cookie a expiré (>1h), redirige vers /login :
 * la session impersonée reste active jusque-là mais on ne peut plus revenir automatiquement. */
export async function quitterImpersonation(): Promise<void> {
  const cookieStore = await cookies()
  const sauvegarde = cookieStore.get(COOKIE_BACKUP_SESSION)?.value
  cookieStore.delete(COOKIE_BACKUP_SESSION)

  if (!sauvegarde) redirect('/login')

  const { access_token, refresh_token } = JSON.parse(sauvegarde)
  const supabase = await createClient()
  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) redirect('/login')

  redirect('/apercu')
}
