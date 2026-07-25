'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { chargerPersona, chargerSession, chargerMessagesTuteur } from '@/lib/tuteurIaServer'
import { construirePromptSystemeTuteur, construireMessagesHaiku } from '@/lib/tuteurIa'

async function chargerBeneficiaire(supabase: Awaited<ReturnType<typeof createClient>>, beneficiaireId: string) {
  const { data } = await supabase.from('beneficiaires').select('id, organisation_id').eq('id', beneficiaireId).single()
  return data
}

/** Crée la session — gratuite en elle-même, le crédit n'est débité qu'au premier
 * message (voir envoyerMessageTuteur) : choisir une persona et un document ne coûte
 * rien tant qu'aucune question n'a été posée. */
export async function demarrerSessionTuteur(
  beneficiaireId: string,
  personaId: string,
  documentId: string | null,
): Promise<{ error: string | null; sessionId?: string }> {
  const supabase = await createClient()
  const beneficiaire = await chargerBeneficiaire(supabase, beneficiaireId)
  if (!beneficiaire) return { error: 'Bénéficiaire introuvable.' }

  const persona = await chargerPersona(supabase, personaId)
  if (!persona) return { error: 'Persona introuvable.' }

  if (documentId) {
    const { data: document } = await supabase
      .from('documents_beneficiaires')
      .select('id, valide_par')
      .eq('id', documentId)
      .eq('beneficiaire_id', beneficiaireId)
      .maybeSingle()
    if (!document) return { error: 'Document introuvable.' }
    if (!document.valide_par) return { error: 'Ce document doit d’abord être validé par un formateur ou éducateur.' }
  }

  const { data: session, error } = await supabase
    .from('tuteur_sessions')
    .insert({ beneficiaire_id: beneficiaireId, organisation_id: beneficiaire.organisation_id, persona_id: personaId, document_id: documentId })
    .select('id')
    .single()
  if (error || !session) return { error: 'Impossible de créer la session.' }

  return { error: null, sessionId: session.id }
}

/**
 * Envoie un message et obtient la réponse de l'IA — débite le crédit de la persona
 * uniquement lors du PREMIER message de la session (coût par session, pas par tour de
 * dialogue), jamais avant qu'un vrai échange ait commencé. Bloquée sans
 * ANTHROPIC_API_KEY, même garde-fou que genererQuizPayant/finaliserGenerationCv.
 */
export async function envoyerMessageTuteur(beneficiaireId: string, sessionId: string, message: string): Promise<{ error: string | null }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'L’Espace Tuteurs IA n’est pas encore activé sur cette instance (clé API manquante). Contactez le Fondateur.' }
  }
  const texte = message.trim()
  if (!texte) return { error: 'Message vide.' }

  const supabase = await createClient()
  const session = await chargerSession(supabase, sessionId)
  if (!session) return { error: 'Session introuvable.' }
  if (session.statut !== 'active') return { error: 'Cette session est terminée.' }

  const persona = await chargerPersona(supabase, session.personaId)
  if (!persona) return { error: 'Persona introuvable.' }

  if (session.creditsConsommes === 0) {
    const { data: debitOk } = await supabase.rpc('debiter_credit_revision', { p_beneficiaire_id: beneficiaireId, p_montant: persona.coutCredits })
    if (!debitOk) return { error: 'Solde de crédits insuffisant.' }
    await supabase.from('tuteur_sessions').update({ credits_consommes: persona.coutCredits }).eq('id', sessionId)
  }

  const { error: erreurInsertUser } = await supabase.from('tuteur_messages').insert({ session_id: sessionId, role: 'user', contenu: texte })
  if (erreurInsertUser) return { error: 'Impossible d’enregistrer ton message.' }

  let contenuDocument: string | null = null
  if (session.documentId) {
    const { data: document } = await supabase.from('documents_beneficiaires').select('contenu_texte').eq('id', session.documentId).maybeSingle()
    contenuDocument = document?.contenu_texte ?? null
  }

  const historique = await chargerMessagesTuteur(supabase, sessionId)
  const promptSysteme = construirePromptSystemeTuteur(persona, contenuDocument)

  let reponseTexte: string
  try {
    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1200,
        system: promptSysteme,
        messages: construireMessagesHaiku(historique),
      }),
    })
    if (!reponse.ok) return { error: 'La réponse du tuteur a échoué (service IA indisponible). Réessaie plus tard.' }
    const donnees = await reponse.json()
    reponseTexte = donnees?.content?.[0]?.text ?? ''
    if (!reponseTexte) return { error: 'La réponse du tuteur est vide. Réessaie plus tard.' }
  } catch {
    return { error: 'La réponse du tuteur a échoué. Réessaie plus tard.' }
  }

  const { error: erreurInsertAssistant } = await supabase.from('tuteur_messages').insert({ session_id: sessionId, role: 'assistant', contenu: reponseTexte })
  if (erreurInsertAssistant) return { error: 'Réponse reçue mais impossible à enregistrer.' }

  revalidatePath(`/mon-espace/${beneficiaireId}/tuteurs/${sessionId}`)
  return { error: null }
}

export async function terminerSessionTuteur(beneficiaireId: string, sessionId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.from('tuteur_sessions').update({ statut: 'terminee' }).eq('id', sessionId)
  if (error) return { error: 'Impossible de terminer la session.' }
  revalidatePath(`/mon-espace/${beneficiaireId}/tuteurs`)
  return { error: null }
}
