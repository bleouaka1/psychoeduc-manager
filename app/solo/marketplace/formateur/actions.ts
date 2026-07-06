'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Contact d'un formateur depuis son profil public — passe par la messagerie
 * interne existante (table `messages`), jamais d'email en clair affiché
 * publiquement. Protection anti-spam minimale : authentification obligatoire
 * (déjà imposée par toute l'app), pas de rate-limiter dédié construit ici.
 */
export async function contacterFormateur(organisationId: string, formData: FormData): Promise<{ error: string | null }> {
  const contenu = String(formData.get('contenu') ?? '').trim()
  if (!contenu) return { error: 'Le message ne peut pas être vide.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Vous devez être connecté pour contacter un formateur.' }

  // Le RLS de `messages` scope la lecture par destinataire_id/expediteur_id : on
  // adresse donc le message à un membre actif de l'organisation (le propriétaire,
  // dans le cas très majoritaire d'un compte Solo/Employeur mono-utilisateur).
  // Fonction SECURITY DEFINER : un visiteur externe n'a pas accès en lecture à
  // membres_organisations d'une organisation dont il n'est pas membre.
  const { data: destinataireId } = await supabase.rpc('premier_membre_actif', { p_organisation_id: organisationId })

  const { error } = await supabase.from('messages').insert({
    organisation_id: organisationId,
    expediteur_id: user.id,
    destinataire_id: destinataireId ?? null,
    contenu,
    type_message: 'suivi',
    canal: 'interne',
    created_by: user.id,
  })

  if (error) return { error: error.message }
  return { error: null }
}
