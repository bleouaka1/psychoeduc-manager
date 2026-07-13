import type { SupabaseClient } from '@supabase/supabase-js'

export const TYPES_COMPTE_INSCRIPTIBLES = ['solo', 'structure', 'employeur'] as const
export type TypeCompteInscriptible = (typeof TYPES_COMPTE_INSCRIPTIBLES)[number]

/**
 * Un même profil peut cumuler une organisation (Fondateur/Formateur/...) ET un ou
 * plusieurs dossiers bénéficiaire actifs (CLAUDE-CODE-COMPTES-MULTIPROFILS.md) —
 * aucune ligne membres_organisations n'est créée pour un dossier bénéficiaire
 * (RLS déjà scopée directement par beneficiaires.profile_id = auth.uid(), cf.
 * PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md). Priorité de redirection :
 * une organisation active passe avant un dossier bénéficiaire seul, mais un
 * sélecteur de bascule reste disponible dans les deux vues.
 */
export async function compteAAccesBeneficiaire(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { count } = await supabase.from('beneficiaires').select('id', { count: 'exact', head: true }).eq('profile_id', user.id)
  return (count ?? 0) > 0
}

/** Où atterrit un utilisateur juste après connexion, selon le(s) type(s) d'organisation
 * dont il est membre actif. Solo/Employeur ont leur propre console dédiée ; tout le reste
 * (Fondateur, Structure, comptes multi-rôles) utilise la console générale du Cockpit.
 * Retourne `null` si le profil n'est membre actif d'aucune organisation — utilisé par
 * le sélecteur de bascule multiprofils pour savoir s'il y a un "côté organisation" à proposer. */
export async function destinationOrganisationActive(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('membres_organisations')
    .select('organisations(type_organisation)')
    .eq('profile_id', user.id)
    .eq('statut', 'actif')

  const types = new Set((data ?? []).map((m: any) => m.organisations?.type_organisation).filter(Boolean))
  if (types.has('solo')) return '/solo'
  if (types.has('employeur')) return '/employeur'
  if (types.size > 0) return '/dashboard'
  return null
}

export async function resoudreDestinationConnexion(supabase: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return '/login'

  const destinationOrg = await destinationOrganisationActive(supabase)
  if (destinationOrg) return destinationOrg

  if (await compteAAccesBeneficiaire(supabase)) return '/mon-espace'
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

/**
 * Rattache un profil fraîchement authentifié à sa fiche bénéficiaire, si un
 * token d'invitation en attente a été conservé en user_metadata au moment du
 * signUp() (cf. app/inscription-beneficiaire/actions.ts). Rejouée sans risque à
 * chaque connexion (idempotente : no-op dès que le token a déjà été consommé ou
 * qu'aucun token n'est présent), même principe que finaliserOrganisationEnAttente.
 * La liaison elle-même passe par une fonction SECURITY DEFINER (finaliser_acces_beneficiaire)
 * car beneficiaires_update exige peut_modifier(organisation_id), qu'un bénéficiaire
 * ne peut structurellement jamais satisfaire.
 */
export async function finaliserAccesBeneficiaire(supabase: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const token = user.user_metadata?.invitation_beneficiaire_token
  if (!token) return

  await supabase.rpc('finaliser_acces_beneficiaire', { p_token: token })
}

/**
 * Équivalent de finaliserAccesBeneficiaire pour les invitations Structure §4.4 (membre
 * d'équipe ou parent/tuteur) — token conservé dans `invitation_generale_token` plutôt
 * que `invitation_beneficiaire_token` (mécaniques de rattachement différentes : l'une
 * met à jour beneficiaires.profile_id, l'autre crée une adhésion ou un lien parent).
 * Essaie les deux RPC de finalisation : chacune filtre déjà strictement sur son propre
 * sous-ensemble de role_propose (membre d'équipe = beneficiaire_id IS NULL, parent/tuteur
 * = beneficiaire_id IS NOT NULL), donc au plus une des deux peut réellement s'appliquer —
 * pas besoin de lire role_propose côté client pour aiguiller.
 */
export async function finaliserInvitationGenerale(supabase: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const token = user.user_metadata?.invitation_generale_token
  if (!token) return

  await supabase.rpc('finaliser_acces_membre_equipe', { p_token: token })
  await supabase.rpc('finaliser_acces_parent', { p_token: token })
}
