'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { chargerAbonnementBaseActif } from '@/lib/abonnementBase'
import { genererFlashcardsBase, construirePromptMnemotechnique, parserAidesMnemotechniques } from '@/lib/flashcards'
import { chargerFlashcardsParDocument } from '@/lib/flashcardsServer'

async function chargerDocument(supabase: Awaited<ReturnType<typeof createClient>>, beneficiaireId: string, documentId: string) {
  const { data } = await supabase
    .from('documents_beneficiaires')
    .select('id, organisation_id, contenu_texte, valide_par')
    .eq('id', documentId)
    .eq('beneficiaire_id', beneficiaireId)
    .maybeSingle()
  return data
}

/** Génération des flashcards (palier base, §12.1) — couverte par l'abonnement de
 * base, aucun crédit débité (même pipeline NLP que le quiz gratuit). */
export async function genererFlashcardsAction(beneficiaireId: string, documentId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const abonnement = await chargerAbonnementBaseActif(supabase, beneficiaireId)
  if (abonnement.statut !== 'actif') {
    return { error: 'Un abonnement de base (200 FCFA/mois) est nécessaire pour générer des flashcards. Demande à ta structure ou à un parent de le prendre en charge si besoin.' }
  }

  const document = await chargerDocument(supabase, beneficiaireId, documentId)
  if (!document) return { error: 'Document introuvable.' }
  if (!document.valide_par) return { error: 'Ce document doit d’abord être validé par un formateur ou éducateur.' }
  if (!document.contenu_texte) return { error: 'Ce document n’a pas de contenu exploitable.' }

  const cartes = genererFlashcardsBase(document.contenu_texte)
  if (cartes.length === 0) return { error: 'Aucune définition reconnaissable dans ce document pour générer des flashcards.' }

  const { error } = await supabase
    .from('flashcards_revision')
    .insert(cartes.map((c) => ({ document_id: documentId, beneficiaire_id: beneficiaireId, organisation_id: document.organisation_id, recto: c.recto, verso: c.verso })))
  if (error) return { error: 'Impossible d’enregistrer les flashcards.' }

  revalidatePath(`/mon-espace/${beneficiaireId}/revisions/flashcards/${documentId}`)
  return { error: null }
}

/**
 * Ajoute une aide mnémotechnique par carte (palier avancé, §12.3) — débite 1 crédit
 * pour l'ensemble du lot (pas par carte), appelle Haiku une seule fois. Bloquée sans
 * ANTHROPIC_API_KEY, même garde-fou que le reste des fonctionnalités IA du projet.
 */
export async function genererMnemotechniqueAction(beneficiaireId: string, documentId: string): Promise<{ error: string | null }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'L’aide mnémotechnique n’est pas encore activée sur cette instance (clé API manquante). Contactez le Fondateur.' }
  }

  const supabase = await createClient()
  const cartes = await chargerFlashcardsParDocument(supabase, documentId)
  const cartesSansAide = cartes.filter((c) => !c.mnemotechnique)
  if (cartesSansAide.length === 0) return { error: null }

  const { data: debitOk } = await supabase.rpc('debiter_credit_revision', { p_beneficiaire_id: beneficiaireId, p_montant: 1 })
  if (!debitOk) return { error: 'Solde de crédits insuffisant.' }

  const promptSysteme = construirePromptMnemotechnique(cartesSansAide.map((c) => ({ recto: c.recto, verso: c.verso })))

  let aides: Map<string, string>
  try {
    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2000,
        system: promptSysteme,
        messages: [{ role: 'user', content: 'Génère les aides mnémotechniques.' }],
      }),
    })
    if (!reponse.ok) return { error: 'La génération a échoué (service IA indisponible). Réessaie plus tard.' }
    const donnees = await reponse.json()
    const texteBrut = donnees?.content?.[0]?.text ?? ''
    aides = parserAidesMnemotechniques(JSON.parse(texteBrut))
  } catch {
    return { error: 'La génération a échoué (réponse IA invalide). Réessaie plus tard.' }
  }

  for (const carte of cartesSansAide) {
    const aide = aides.get(carte.recto)
    if (aide) await supabase.from('flashcards_revision').update({ mnemotechnique: aide }).eq('id', carte.id)
  }

  revalidatePath(`/mon-espace/${beneficiaireId}/revisions/flashcards/${documentId}`)
  return { error: null }
}
