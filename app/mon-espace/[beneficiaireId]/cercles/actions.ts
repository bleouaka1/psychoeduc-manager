'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function trouverAppartenance(supabase: Awaited<ReturnType<typeof createClient>>, beneficiaireId: string, cercleId: string) {
  return supabase.from('cercles_membres').select('id, statut').eq('cercle_id', cercleId).eq('beneficiaire_id', beneficiaireId).maybeSingle()
}

/** Le bénéficiaire accepte sa propre invitation ('invite' -> 'actif') — RLS déjà
 * ouverte (cercles_membres_update, migration 20260727000000). Rejoint aussi la
 * conversation de groupe du cercle (conversation_participants_insert autorise déjà
 * profile_id = auth.uid() sans condition préalable — RLS non bloquante ici). */
export async function accepterInvitationCercleAction(beneficiaireId: string, cercleId: string): Promise<void> {
  const supabase = await createClient()
  const { data: appartenance } = await trouverAppartenance(supabase, beneficiaireId, cercleId)
  if (!appartenance || appartenance.statut !== 'invite') return

  await supabase.from('cercles_membres').update({ statut: 'actif' }).eq('id', appartenance.id)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: cercle } = await supabase.from('cercles_apprentissage').select('conversation_id').eq('id', cercleId).maybeSingle()
  if (user && cercle?.conversation_id) {
    await supabase.from('conversation_participants').insert({ conversation_id: cercle.conversation_id, profile_id: user.id, role_participant: 'beneficiaire' })
  }

  revalidatePath(`/mon-espace/${beneficiaireId}/cercles`)
}

/** Sortie sans trace négative visible aux autres membres (§5.3) : un simple
 * changement de statut, jamais une suppression qui effacerait l'historique.
 * Redirige explicitement vers la liste : rester sur la page détail après la sortie
 * la ferait échouer sur son propre garde-fou (statut !== 'actif' -> notFound()). */
export async function quitterCercleAction(beneficiaireId: string, cercleId: string): Promise<void> {
  const supabase = await createClient()
  const { data: appartenance } = await trouverAppartenance(supabase, beneficiaireId, cercleId)
  if (!appartenance) return

  await supabase.from('cercles_membres').update({ statut: 'sorti' }).eq('id', appartenance.id)
  revalidatePath(`/mon-espace/${beneficiaireId}/cercles`)
  redirect(`/mon-espace/${beneficiaireId}/cercles`)
}

/** Bouton "signaler" (§5.3) : toujours disponible, discret — remonte à l'animateur
 * via le mécanisme de notifications déjà en place (Étape 20), jamais de détail
 * exposé publiquement. */
export async function signalerCercleAction(beneficiaireId: string, cercleId: string): Promise<void> {
  const supabase = await createClient()
  const { data: cercle } = await supabase.from('cercles_apprentissage').select('nom, organisation_id, animateur_profile_id').eq('id', cercleId).maybeSingle()
  if (!cercle) return

  await supabase.from('notifications').insert({
    profile_id: cercle.animateur_profile_id,
    organisation_id: cercle.organisation_id,
    titre: 'Signalement — Cercle d’apprentissage',
    contenu: `Un membre du cercle « ${cercle.nom} » a signalé une situation nécessitant votre attention.`,
    type_notification: 'signalement_cercle',
  })
}

export async function envoyerMessageCercleBeneficiaireAction(beneficiaireId: string, cercleId: string, conversationId: string, organisationId: string, formData: FormData): Promise<void> {
  const contenu = String(formData.get('contenu') ?? '').trim()
  if (!contenu) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('messages').insert({ conversation_id: conversationId, organisation_id: organisationId, expediteur_id: user.id, contenu, type_message: 'suivi', canal: 'interne' })
  revalidatePath(`/mon-espace/${beneficiaireId}/cercles/${cercleId}`)
}
