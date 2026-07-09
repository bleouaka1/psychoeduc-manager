import { createClient } from '@/lib/supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

/** Compte non-lus, tous participants confondus — simple pour une conversation à 2
 * (V1) : un message d'autrui pas encore marqué 'lu' compte comme non-lu. */
export async function compterMessagesNonLus(): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: participations } = await supabase.from('conversation_participants').select('conversation_id').eq('profile_id', user.id)
  const conversationIds = (participations ?? []).map((p: any) => p.conversation_id)
  if (conversationIds.length === 0) return 0

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', conversationIds)
    .neq('expediteur_id', user.id)
    .neq('statut', 'lu')

  return count ?? 0
}

/** Deux profils ne peuvent démarrer une conversation que s'ils partagent un
 * bénéficiaire commun, sauf le Fondateur qui peut initier avec n'importe qui
 * (§ règles métier du document source). Vérifié applicativement — la RLS reste
 * le garde-fou d'accès, pas le moteur de cette règle de création. */
async function peuventDemarrerConversation(supabase: SupabaseServer, cibleId: string, beneficiaireId: string | null): Promise<boolean> {
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (estFondateur) return true

  // La cible est potentiellement le Fondateur : toujours autorisé, symétrique au
  // mécanisme "Contacter le Fondateur" déjà en place ailleurs dans l'app.
  // `profil_est_fondateur` est SECURITY DEFINER : une lecture directe de
  // membres_organisations de l'organisation du Fondateur serait bloquée par RLS
  // pour tout appelant qui n'en est pas membre.
  const { data: cibleEstFondateur } = await supabase.rpc('profil_est_fondateur', { p_profile_id: cibleId })
  if (cibleEstFondateur) return true

  if (!beneficiaireId) return false

  const { data: affectationCible } = await supabase
    .from('affectations_personnel')
    .select('id, membres_organisations!inner(profile_id)')
    .eq('cible_type', 'beneficiaire')
    .eq('cible_id', beneficiaireId)
    .eq('statut', 'active')
    .eq('membres_organisations.profile_id', cibleId)
    .maybeSingle()

  return Boolean(affectationCible)
}

export async function creerConversation(
  beneficiaireId: string | null,
  organisationId: string,
  titre: string | null,
  profileIdCible: string,
): Promise<{ conversationId: string | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { conversationId: null, error: 'Non authentifié.' }

  const autorise = await peuventDemarrerConversation(supabase, profileIdCible, beneficiaireId)
  if (!autorise) return { conversationId: null, error: 'Cette conversation nécessite un bénéficiaire commun entre les deux profils.' }

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({ beneficiaire_id: beneficiaireId, organisation_id: organisationId, titre, created_by: user.id })
    .select('id')
    .single()
  if (error || !conversation) return { conversationId: null, error: 'Impossible de créer la conversation.' }

  // Deux appels séparés, jamais un insert groupé : dans un même INSERT multi-lignes,
  // chaque ligne est vérifiée par RLS contre l'état de la table AVANT le batch — la
  // ligne du créateur (qui rend `est_participant_conversation` vrai pour la ligne
  // suivante) n'est pas encore visible pour la seconde ligne du même batch, ce qui
  // fait échouer tout le batch silencieusement. Un appel par ligne, dans l'ordre.
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  const { error: erreurParticipantCreateur } = await supabase
    .from('conversation_participants')
    .insert({ conversation_id: conversation.id, profile_id: user.id, role_participant: estFondateur ? 'fondateur' : 'staff' })
  if (erreurParticipantCreateur) return { conversationId: null, error: 'Impossible d’ajouter le créateur comme participant.' }

  const { error: erreurParticipantCible } = await supabase
    .from('conversation_participants')
    .insert({ conversation_id: conversation.id, profile_id: profileIdCible, role_participant: 'staff' })
  if (erreurParticipantCible) return { conversationId: null, error: 'Impossible d’ajouter le destinataire comme participant.' }

  return { conversationId: conversation.id, error: null }
}

export async function envoyerMessageInterne(conversationId: string, organisationId: string, contenu: string): Promise<{ error: string | null }> {
  const contenuNettoye = contenu.trim()
  if (!contenuNettoye) return { error: 'Le message ne peut pas être vide.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    organisation_id: organisationId,
    expediteur_id: user.id,
    contenu: contenuNettoye,
    type_message: 'suivi',
    canal: 'interne',
    created_by: user.id,
  })
  return { error: error ? 'Impossible d’envoyer ce message.' : null }
}

/** Réservé au Fondateur (règle métier explicite du document source). */
export async function demanderPieceJustificative(
  conversationId: string,
  organisationId: string,
  typeDocument: string,
  note: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) return { error: 'Seul le Fondateur peut demander une pièce justificative.' }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // `messages_update` (Étape 20) n'autorise un non-fondateur à mettre à jour une
  // ligne que si `destinataire_id = auth.uid()` — sans ce champ, le destinataire
  // ne pourrait jamais faire passer sa propre demande à "reçue" plus tard
  // (repondreAvecPieceJointe). Résolu ici : l'autre participant de la conversation.
  const { data: autreParticipant } = await supabase
    .from('conversation_participants')
    .select('profile_id')
    .eq('conversation_id', conversationId)
    .neq('profile_id', user?.id ?? '')
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    organisation_id: organisationId,
    expediteur_id: user?.id,
    destinataire_id: autreParticipant?.profile_id ?? null,
    contenu: note.trim() || `Demande de pièce : ${typeDocument}`,
    type_message: 'demande_piece',
    type_document: typeDocument,
    statut_demande: 'en_attente',
    canal: 'interne',
    created_by: user?.id,
  })
  return { error: error ? 'Impossible d’envoyer la demande.' : null }
}

/** Passage automatique du dernier `demande_piece` en_attente de la conversation à
 * `recu` — logique applicative comme demandé par le document, pas de trigger SQL. */
export async function repondreAvecPieceJointe(
  conversationId: string,
  organisationId: string,
  fichierPath: string,
  nomOriginal: string,
  tailleOctets: number,
  typeMime: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      organisation_id: organisationId,
      expediteur_id: user.id,
      contenu: `Pièce jointe : ${nomOriginal}`,
      type_message: 'suivi',
      canal: 'interne',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !message) return { error: 'Impossible d’envoyer la pièce jointe.' }

  await supabase.from('pieces_jointes').insert({
    message_id: message.id,
    fichier_path: fichierPath,
    nom_original: nomOriginal,
    taille_octets: tailleOctets,
    type_mime: typeMime,
    created_by: user.id,
  })

  const { data: derniereDemandeEnAttente } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('type_message', 'demande_piece')
    .eq('statut_demande', 'en_attente')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (derniereDemandeEnAttente) {
    await supabase.from('messages').update({ statut_demande: 'recu' }).eq('id', derniereDemandeEnAttente.id)
  }

  return { error: null }
}
