'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { chargerPrixCourant } from '@/lib/pricing'
import { chargerDonneesCvBeneficiaire } from '@/lib/cvServer'
import { construirePromptCv, parserContenuCv } from '@/lib/cv'
import { estMineur } from '@/lib/cerclesApprentissage'

async function chargerBeneficiaire(supabase: Awaited<ReturnType<typeof createClient>>, beneficiaireId: string) {
  const { data } = await supabase
    .from('beneficiaires')
    .select('id, nom, prenoms, date_naissance, organisation_id, organisations(nom)')
    .eq('id', beneficiaireId)
    .single()
  return data
}

/**
 * Crée la demande de génération (statut 'en_attente', jamais confirmée ici) — §2.4
 * point 1 : ne jamais générer avant confirmation RÉELLE du paiement par le prestataire.
 * Bloquée tant qu'aucun prestataire n'est configuré (CV_PAIEMENT_PROVIDER), même
 * posture que le garde-fou ANTHROPIC_API_KEY sur le quiz payant : le code du flux
 * complet est écrit (voir finaliserGenerationCv ci-dessous) mais inatteignable tant
 * que ce choix n'est pas fait avec Angenor (PayDunya/CinetPay/FedaPay/Kkiapay, cf.
 * handoff-quiz-revision-ia-3.md §7). Une fois câblé, le webhook du prestataire doit
 * appeler confirmer_paiement_cv() (RPC service_role uniquement, jamais depuis un
 * client authentifié) puis cette page permet de finaliser la génération.
 */
export async function demarrerGenerationCv(
  beneficiaireId: string,
): Promise<{ error: string | null; generationId?: string; montant?: number; devise?: string }> {
  const supabase = await createClient()
  const beneficiaire = await chargerBeneficiaire(supabase, beneficiaireId)
  if (!beneficiaire) return { error: 'Bénéficiaire introuvable.' }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const prix = await chargerPrixCourant(supabase, 'generation_cv')
  if (!prix) return { error: 'Tarif de génération de CV non configuré.' }

  if (!process.env.CV_PAIEMENT_PROVIDER) {
    return { error: 'Le paiement du CV n’est pas encore activé sur cette instance (aucun prestataire de paiement configuré). Contactez le Fondateur.' }
  }

  const { data: generation, error } = await supabase
    .from('cv_generations')
    .insert({ compte_id: user.id, type_compte: 'beneficiaire', montant_paye: prix.montant, devise: prix.devise, statut: 'en_attente' })
    .select('id')
    .single()
  if (error || !generation) return { error: 'Impossible de créer la demande de génération.' }

  // TODO (une fois CV_PAIEMENT_PROVIDER câblé) : rediriger ici vers le checkout du
  // prestataire retenu ; ne rien générer avant que son webhook ait confirmé le paiement.

  return { error: null, generationId: generation.id, montant: prix.montant, devise: prix.devise }
}

/**
 * Génère réellement le contenu du CV — n'agit que sur une génération déjà `confirme`
 * (le paiement a été validé par le webhook du prestataire, jamais par ce code). Bloquée
 * sans ANTHROPIC_API_KEY, même garde-fou que genererQuizPayant.
 */
export async function finaliserGenerationCv(beneficiaireId: string, generationId: string): Promise<{ error: string | null }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'La génération de CV n’est pas encore activée sur cette instance (clé API manquante). Contactez le Fondateur.' }
  }

  const supabase = await createClient()
  const { data: generation } = await supabase.from('cv_generations').select('id, statut, contenu_json').eq('id', generationId).single()
  if (!generation) return { error: 'Génération introuvable.' }
  if (generation.statut !== 'confirme') return { error: 'Le paiement n’a pas encore été confirmé pour cette génération.' }
  if (generation.contenu_json) return { error: null }

  const beneficiaire = await chargerBeneficiaire(supabase, beneficiaireId)
  if (!beneficiaire) return { error: 'Bénéficiaire introuvable.' }

  const donneesSource = await chargerDonneesCvBeneficiaire(supabase, beneficiaireId, {
    prenoms: beneficiaire.prenoms,
    nom: beneficiaire.nom,
    organisationNom: (beneficiaire as any).organisations?.nom ?? null,
  })
  const mineur = estMineur(beneficiaire.date_naissance)
  const promptSysteme = construirePromptCv(donneesSource, mineur)

  let contenuJson: unknown
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
        max_tokens: 2000,
        system: promptSysteme,
        messages: [{ role: 'user', content: 'Génère le document.' }],
      }),
    })
    if (!reponse.ok) return { error: 'La génération a échoué (service IA indisponible). Réessayez plus tard.' }
    const donnees = await reponse.json()
    const texteBrut = donnees?.content?.[0]?.text ?? ''
    contenuJson = JSON.parse(texteBrut)
  } catch {
    return { error: 'La génération a échoué (réponse IA invalide). Réessayez plus tard.' }
  }

  const contenu = parserContenuCv(contenuJson)
  if (!contenu) return { error: 'La génération a échoué (format de réponse invalide). Réessayez plus tard.' }

  const { error: erreurEnregistrement } = await supabase.rpc('enregistrer_contenu_cv', { p_generation_id: generationId, p_contenu: contenuJson })
  if (erreurEnregistrement) return { error: 'Impossible d’enregistrer le CV généré.' }

  revalidatePath(`/mon-espace/${beneficiaireId}/cv`)
  return { error: null }
}
