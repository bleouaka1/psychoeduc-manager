import { createClient } from '@/lib/supabase/server'

/** Messagerie de modération (Fondateur ↔ vendeur) rattachée à une offre marketplace
 * précise, partagée entre le module Compte Solo et le module Employeur — même
 * table `messages` que le reste du projet (pas de système parallèle), scopée par
 * `marketplace_offre_id` (migration 20260717000000_messages_marketplace_offre.sql). */
export type MessageModerationAffiche = {
  id: string
  offreId: string
  offreTitre: string
  contenu: string
  created_at: string
  estMoi: boolean
}

export async function chargerMessagesModerationOrganisation(organisationId: string): Promise<MessageModerationAffiche[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('messages')
    .select('id, contenu, created_at, expediteur_id, marketplace_offre_id, marketplace_offres(titre)')
    .eq('organisation_id', organisationId)
    .eq('type_message', 'moderation_marketplace')
    .not('marketplace_offre_id', 'is', null)
    .order('created_at', { ascending: true })

  return (data ?? []).map((m: any) => ({
    id: m.id,
    offreId: m.marketplace_offre_id,
    offreTitre: m.marketplace_offres?.titre ?? 'Offre',
    contenu: m.contenu,
    created_at: m.created_at,
    estMoi: m.expediteur_id === user?.id,
  }))
}

/** Réponse du vendeur : le destinataire est le dernier expéditeur du fil qui n'est pas
 * l'utilisateur courant (peu importe quel Fondateur précisément — `is_fondateur()`
 * dans `messages_select` couvre déjà la visibilité pour tout compte Fondateur). */
export async function repondreMessageOffre(offreId: string, contenu: string): Promise<{ error: string | null }> {
  const contenuNettoye = contenu.trim()
  if (!contenuNettoye) return { error: 'Le message ne peut pas être vide.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: offre } = await supabase.from('marketplace_offres').select('id, titre, organisation_id').eq('id', offreId).maybeSingle()
  if (!offre) return { error: 'Offre introuvable.' }

  const { data: dernierMessageFondateur } = await supabase
    .from('messages')
    .select('expediteur_id')
    .eq('marketplace_offre_id', offreId)
    .neq('expediteur_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('messages').insert({
    organisation_id: offre.organisation_id,
    expediteur_id: user.id,
    destinataire_id: dernierMessageFondateur?.expediteur_id ?? null,
    marketplace_offre_id: offreId,
    type_message: 'moderation_marketplace',
    canal: 'interne',
    contenu: contenuNettoye,
  })
  if (error) return { error: 'Impossible d’envoyer la réponse.' }

  if (dernierMessageFondateur?.expediteur_id) {
    await supabase.from('notifications').insert({
      profile_id: dernierMessageFondateur.expediteur_id,
      organisation_id: offre.organisation_id,
      titre: 'Réponse du vendeur',
      contenu: `Réponse au sujet de « ${offre.titre} » : ${contenuNettoye}`,
      type_notification: 'moderation_marketplace',
    })
  }

  return { error: null }
}
