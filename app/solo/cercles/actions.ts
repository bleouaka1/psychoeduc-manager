'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../_lib/getSoloOrg'
import { peutRejoindreCercle } from '@/lib/cerclesApprentissage'

export async function creerCercleAction(formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const nom = String(formData.get('nom') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const charte = String(formData.get('charte') ?? '').trim()
  const reserveAdultes = formData.get('reserve_adultes') === 'on'
  const tarif = formData.get('tarif') ? Number(formData.get('tarif')) : null
  if (!nom) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  // Conversation de groupe créée d'abord (le cercle la référence), le créateur
  // ajouté comme participant AVANT toute chose : sans ça, est_participant_conversation()
  // resterait faux pour lui-même. Jamais un insert groupé de participants (cf.
  // lib/messagerieInterne.ts::creerConversation — un batch multi-lignes échoue
  // silencieusement sous RLS, chaque ligne étant vérifiée contre l'état AVANT le batch).
  const { data: conversation, error: erreurConversation } = await supabase
    .from('conversations')
    .insert({ organisation_id: organisation.id, titre: `Cercle — ${nom}`, created_by: user.id })
    .select('id')
    .single()
  if (erreurConversation || !conversation) return

  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  await supabase.from('conversation_participants').insert({ conversation_id: conversation.id, profile_id: user.id, role_participant: estFondateur ? 'fondateur' : 'staff' })

  await supabase.from('cercles_apprentissage').insert({
    organisation_id: organisation.id,
    animateur_profile_id: user.id,
    conversation_id: conversation.id,
    nom,
    description: description || null,
    charte: charte || null,
    reserve_adultes: reserveAdultes,
    tarif,
    created_by: user.id,
  })

  revalidatePath('/solo/cercles')
}

/** Vérification d'âge automatique (§5.2) appliquée ici, jamais laissée au seul
 * jugement de l'UI — un cercle réservé aux adultes ne peut jamais recevoir un mineur. */
export async function inviterMembreAction(cercleId: string, formData: FormData): Promise<void> {
  const beneficiaireId = String(formData.get('beneficiaireId') ?? '')
  if (!beneficiaireId) return

  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const supabase = await createClient()
  const { data: cercle } = await supabase.from('cercles_apprentissage').select('reserve_adultes').eq('id', cercleId).eq('organisation_id', organisation.id).maybeSingle()
  if (!cercle) return

  const { data: beneficiaire } = await supabase.from('beneficiaires').select('date_naissance').eq('id', beneficiaireId).eq('organisation_id', organisation.id).maybeSingle()
  if (!beneficiaire) return

  if (!peutRejoindreCercle(cercle.reserve_adultes, beneficiaire.date_naissance)) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('cercles_membres').insert({ cercle_id: cercleId, beneficiaire_id: beneficiaireId, invite_par: user?.id })
  revalidatePath(`/solo/cercles/${cercleId}`)
}

export async function envoyerMessageCercleAction(cercleId: string, conversationId: string, organisationId: string, formData: FormData): Promise<void> {
  const contenu = String(formData.get('contenu') ?? '').trim()
  if (!contenu) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('messages').insert({ conversation_id: conversationId, organisation_id: organisationId, expediteur_id: user.id, contenu, type_message: 'suivi', canal: 'interne' })
  revalidatePath(`/solo/cercles/${cercleId}`)
}
