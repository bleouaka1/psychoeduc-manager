'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  creerConversation,
  envoyerMessageInterne,
  demanderPieceJustificative,
  repondreAvecPieceJointe,
} from '@/lib/messagerieInterne'

const BUCKET = 'messagerie-pieces-jointes'

export async function envoyerMessageInterneAction(conversationId: string, organisationId: string, formData: FormData): Promise<void> {
  const contenu = String(formData.get('contenu') ?? '')
  await envoyerMessageInterne(conversationId, organisationId, contenu)
  revalidatePath('/messagerie')
  revalidatePath('/solo/messagerie')
}

export async function demanderPieceAction(conversationId: string, organisationId: string, formData: FormData): Promise<void> {
  const typeDocument = String(formData.get('type_document') ?? '').trim()
  const note = String(formData.get('note') ?? '')
  if (!typeDocument) return
  await demanderPieceJustificative(conversationId, organisationId, typeDocument, note)
  revalidatePath('/messagerie')
  revalidatePath('/solo/messagerie')
}

export async function envoyerPieceJointeAction(conversationId: string, organisationId: string, formData: FormData): Promise<{ error: string | null }> {
  const fichier = formData.get('fichier') as File | null
  if (!fichier || fichier.size === 0) return { error: 'Aucun fichier sélectionné.' }
  if (fichier.size > 10 * 1024 * 1024) return { error: 'Fichier trop volumineux (10 Mo maximum).' }
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(fichier.type)) return { error: 'Type de fichier non autorisé (PDF, JPG, PNG uniquement).' }

  const supabase = await createClient()
  const chemin = `${conversationId}/${Date.now()}-${fichier.name}`
  const { error: erreurUpload } = await supabase.storage.from(BUCKET).upload(chemin, fichier, { contentType: fichier.type })
  if (erreurUpload) return { error: 'Échec de l’envoi du fichier.' }

  const res = await repondreAvecPieceJointe(conversationId, organisationId, chemin, fichier.name, fichier.size, fichier.type)
  revalidatePath('/messagerie')
  revalidatePath('/solo/messagerie')
  return res
}

/** Point d'entrée "Ouvrir la messagerie interne" depuis une fiche bénéficiaire :
 * retrouve la conversation existante avec le Fondateur pour ce dossier, ou en
 * crée une nouvelle, puis redirige — jamais de doublon de conversation créé à
 * chaque clic. */
export async function ouvrirConversationBeneficiaire(beneficiaireId: string, organisationId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: conversationExistante } = await supabase
    .from('conversations')
    .select('id, conversation_participants!inner(profile_id)')
    .eq('beneficiaire_id', beneficiaireId)
    .eq('conversation_participants.profile_id', user.id)
    .limit(1)
    .maybeSingle()

  if (conversationExistante) {
    redirect(`/solo/messagerie?conversation=${conversationExistante.id}`)
  }

  const organisationFondateurId = await supabase.rpc('organisation_fondateur')
  const { data: fondateurProfileId } = await supabase.rpc('premier_membre_actif', { p_organisation_id: organisationFondateurId.data })
  if (!fondateurProfileId) return

  const { conversationId } = await creerConversation(beneficiaireId, organisationId, null, fondateurProfileId)
  if (conversationId) redirect(`/solo/messagerie?conversation=${conversationId}`)
}

export async function creerConversationAction(
  beneficiaireId: string | null,
  organisationId: string,
  titre: string | null,
  profileIdCible: string,
): Promise<{ conversationId: string | null; error: string | null }> {
  const res = await creerConversation(beneficiaireId, organisationId, titre, profileIdCible)
  revalidatePath('/messagerie')
  revalidatePath('/solo/messagerie')
  return res
}
