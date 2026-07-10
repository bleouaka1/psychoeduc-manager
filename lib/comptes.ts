import type { SupabaseClient } from '@supabase/supabase-js'

export const TYPES_COMPTE_INSCRIPTIBLES = ['solo', 'structure', 'employeur'] as const
export type TypeCompteInscriptible = (typeof TYPES_COMPTE_INSCRIPTIBLES)[number]

/**
 * Où atterrit un utilisateur juste après connexion, selon le(s) type(s) d'organisation
 * dont il est membre actif. Solo/Employeur ont leur propre console dédiée ; tout le reste
 * (Fondateur, Structure, comptes multi-rôles) utilise la console générale du Cockpit,
 * qui applique déjà son propre cloisonnement par organisation via RLS/`peut_lire`.
 */
export async function resoudreDestinationConnexion(supabase: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return '/login'

  const { data } = await supabase
    .from('membres_organisations')
    .select('organisations(type_organisation)')
    .eq('profile_id', user.id)
    .eq('statut', 'actif')

  const types = new Set((data ?? []).map((m: any) => m.organisations?.type_organisation).filter(Boolean))
  if (types.has('solo')) return '/solo'
  if (types.has('employeur')) return '/employeur'
  return '/dashboard'
}

/**
 * Crée l'organisation choisie à l'inscription si elle n'a pas encore été créée.
 * Nécessaire car `auth.signUp()` peut exiger une confirmation par e-mail avant de renvoyer
 * une session active — dans ce cas l'organisation ne peut pas être créée tout de suite
 * (RLS `organisations_insert` exige `auth.uid() = created_by`, donc un contexte authentifié).
 * Le type de compte choisi est conservé dans `user_metadata` au moment du `signUp()` et
 * cette fonction est rejouée sans risque à chaque connexion tant qu'aucune organisation
 * n'existe encore pour ce profil (idempotent : no-op dès qu'une adhésion existe).
 */
export async function finaliserOrganisationEnAttente(supabase: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { count } = await supabase.from('membres_organisations').select('id', { count: 'exact', head: true }).eq('profile_id', user.id)
  if ((count ?? 0) > 0) return

  const typeOrganisation = user.user_metadata?.type_organisation
  const nomOrganisation = user.user_metadata?.organisation_nom
  if (!typeOrganisation || !TYPES_COMPTE_INSCRIPTIBLES.includes(typeOrganisation)) return

  await supabase.from('organisations').insert({
    nom: nomOrganisation || 'Mon organisation',
    type_organisation: typeOrganisation,
    created_by: user.id,
  })
}
