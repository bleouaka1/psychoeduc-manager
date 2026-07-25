'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { genererQuizGratuit as genererContenuGratuit, RECOMMANDATION_OBJECTIF, type PreferenceObjectif } from '@/lib/quizRevision'
import { chargerAbonnementBaseActif } from '@/lib/abonnementBase'

async function chargerBeneficiaire(supabase: Awaited<ReturnType<typeof createClient>>, beneficiaireId: string) {
  const { data } = await supabase.from('beneficiaires').select('id, organisation_id').eq('id', beneficiaireId).single()
  return data
}

/** Dépôt d'un document source — texte collé/déjà extrait (aucun parsing PDF/DOCX
 * serveur dans ce projet, cf. PLAN_QUIZ_REVISION.md). Entre toujours non-validé
 * (garde-fou mineur, §11 du document).
 * Signature (beneficiaireId, prevState, formData) : liée via useActionState côté
 * client (même pattern que app/login/actions.ts) — une Server Action bindée
 * directement sur <form action> doit retourner Promise<void>, pas {error}. */
export async function deposerDocument(
  beneficiaireId: string,
  _prevState: { error: string | null } | undefined,
  formData: FormData,
): Promise<{ error: string | null }> {
  const nomFichier = String(formData.get('nom_fichier') ?? '').trim()
  const contenuTexte = String(formData.get('contenu_texte') ?? '').trim()
  if (!nomFichier || !contenuTexte) return { error: 'Titre et contenu requis.' }
  if (contenuTexte.length < 100) return { error: 'Le contenu est trop court pour générer un quiz utile (100 caractères minimum).' }

  const beneficiaire = await chargerBeneficiaire(await createClient(), beneficiaireId)
  if (!beneficiaire) return { error: 'Bénéficiaire introuvable.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('documents_beneficiaires').insert({
    beneficiaire_id: beneficiaireId,
    organisation_id: beneficiaire.organisation_id,
    type_document: 'quiz_revision',
    type_source: 'document',
    nom_fichier: nomFichier,
    contenu_texte: contenuTexte,
    televerse_par: user?.id,
  })
  if (error) return { error: 'Impossible de déposer ce document.' }

  revalidatePath(`/mon-espace/${beneficiaireId}/revisions`)
  return { error: null }
}

/** Validation par un membre de l'équipe pédagogique — garde-fou mineur non-négociable :
 * aucune génération de quiz possible tant que ce champ n'est pas renseigné. */
export async function validerDocumentQuiz(beneficiaireId: string, documentId: string): Promise<void> {
  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  const beneficiaire = await chargerBeneficiaire(supabase, beneficiaireId)
  if (!beneficiaire) return

  if (!estFondateur) {
    const { data: peutModifier } = await supabase.rpc('peut_modifier', { p_module: 'quiz_revision', p_organisation_id: beneficiaire.organisation_id })
    if (!peutModifier) return
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase
    .from('documents_beneficiaires')
    .update({ valide_par: user?.id, valide_at: new Date().toISOString() })
    .eq('id', documentId)

  revalidatePath(`/mon-espace/${beneficiaireId}/revisions`)
}

/** Génération gratuite (§5.1) — aucun appel IA, illimitée, aucun quota. */
export async function genererQuizGratuit(
  beneficiaireId: string,
  documentId: string,
  preferenceInitiale: PreferenceObjectif,
): Promise<{ error: string | null; quizId?: string }> {
  const supabase = await createClient()
  const beneficiaire = await chargerBeneficiaire(supabase, beneficiaireId)
  if (!beneficiaire) return { error: 'Bénéficiaire introuvable.' }

  // Abonnement de base requis (200 FCFA/mois, dashboard bénéficiaire v3, Lot H) —
  // renversement de politique confirmé par Angenor avant cette migration. Le message
  // pointe toujours vers une prise en charge par un tiers (structure/parent), jamais
  // un blocage sec (§11 du handoff-quiz-revision-ia-5.md).
  const abonnement = await chargerAbonnementBaseActif(supabase, beneficiaireId)
  if (abonnement.statut !== 'actif') {
    return {
      error:
        'Un abonnement de base (200 FCFA/mois) est nécessaire pour générer des quiz. Demande à ta structure ou à un parent de le prendre en charge si tu ne peux pas payer toi-même.',
    }
  }

  const { data: document } = await supabase
    .from('documents_beneficiaires')
    .select('id, contenu_texte, valide_par')
    .eq('id', documentId)
    .eq('beneficiaire_id', beneficiaireId)
    .single()

  if (!document) return { error: 'Document introuvable.' }
  if (!document.valide_par) return { error: 'Ce document doit d’abord être validé par un formateur ou éducateur.' }
  if (!document.contenu_texte) return { error: 'Ce document n’a pas de contenu exploitable.' }

  const niveau = RECOMMANDATION_OBJECTIF[preferenceInitiale].niveauConseille === 'excellence' ? 'soutenu' : 'standard'
  const contenu = genererContenuGratuit(document.contenu_texte)
  if (contenu.questions.length === 0) return { error: 'Impossible de générer des questions à partir de ce contenu — essayez un texte plus structuré.' }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: quiz, error } = await supabase
    .from('quiz_revision')
    .insert({
      document_id: documentId,
      beneficiaire_id: beneficiaireId,
      organisation_id: beneficiaire.organisation_id,
      palier: 'gratuit',
      niveau_difficulte: niveau,
      preference_initiale: preferenceInitiale,
      chrono_mode: 'par_question',
      chrono_duree_sec: 40,
      contenu_json: contenu,
      created_by: user?.id,
    })
    .select('id')
    .single()

  if (error || !quiz) return { error: 'Impossible de générer le quiz.' }

  revalidatePath(`/mon-espace/${beneficiaireId}/revisions`)
  return { error: null, quizId: quiz.id }
}

/** Génération payante (§5.2) — bloquée sans ANTHROPIC_API_KEY, jamais un appel silencieux
 * qui échouerait de façon confuse. Le crédit n'est débité qu'après succès de l'appel IA
 * et validation du JSON (garde-fou explicite du document). */
export async function genererQuizPayant(
  beneficiaireId: string,
  documentId: string,
  niveauDifficulte: 'soutenu' | 'excellence',
): Promise<{ error: string | null; quizId?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'Le mode approfondi n’est pas encore activé sur cette instance (clé API manquante). Contactez le Fondateur.' }
  }

  const supabase = await createClient()
  const beneficiaire = await chargerBeneficiaire(supabase, beneficiaireId)
  if (!beneficiaire) return { error: 'Bénéficiaire introuvable.' }

  const { data: document } = await supabase
    .from('documents_beneficiaires')
    .select('id, contenu_texte, valide_par')
    .eq('id', documentId)
    .eq('beneficiaire_id', beneficiaireId)
    .single()
  if (!document) return { error: 'Document introuvable.' }
  if (!document.valide_par) return { error: 'Ce document doit d’abord être validé par un formateur ou éducateur.' }
  if (!document.contenu_texte) return { error: 'Ce document n’a pas de contenu exploitable.' }

  const { data: solde } = await supabase.from('credits_revision').select('solde').eq('beneficiaire_id', beneficiaireId).maybeSingle()
  if (!solde || solde.solde < 1) return { error: 'Solde de crédits insuffisant.' }

  const typeQuestions = niveauDifficulte === 'excellence' ? 'ouverte' : 'qcm'
  const promptSysteme = `Tu es un générateur de quiz pédagogique pour un public en insertion socio-professionnelle.
Génère un quiz au format JSON strict, sans texte hors JSON, à partir du contenu fourni.

Niveau de difficulté demandé : ${niveauDifficulte}
- soutenu : distracteurs plausibles et proches, nécessite une bonne compréhension
- excellence : questions ouvertes nécessitant une réponse rédigée, pas de QCM

Type de questions : ${typeQuestions}
Nombre de questions : 50 (minimum ; si le contenu source est trop limité pour 50 questions non redondantes, varie les angles — reformulation, synonymes, inversion définition/terme — plutôt que de répéter une question à l'identique)

Format de sortie JSON :
{"questions":[{"id":"q1","type":"qcm","categorie":"string","enonce":"string","options":["...","...","...","..."],"reponse_correcte":"string","explication":"string"}]}`

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
        // 50 questions structurées (v3) nécessitent bien plus de place qu'un quiz court —
        // budget relevé en conséquence (coût estimé révisé à ~$0.03-0.04/génération, v3 §1).
        max_tokens: 8000,
        system: promptSysteme,
        messages: [{ role: 'user', content: document.contenu_texte.slice(0, 12000) }],
      }),
    })
    if (!reponse.ok) return { error: 'La génération a échoué (service IA indisponible). Réessayez plus tard.' }
    const donnees = await reponse.json()
    const texteBrut = donnees?.content?.[0]?.text ?? ''
    contenuJson = JSON.parse(texteBrut)
  } catch {
    return { error: 'La génération a échoué (réponse IA invalide). Réessayez plus tard.' }
  }

  if (!contenuJson || typeof contenuJson !== 'object' || !Array.isArray((contenuJson as any).questions) || (contenuJson as any).questions.length === 0) {
    return { error: 'La génération a échoué (format de réponse invalide). Réessayez plus tard.' }
  }

  // Débit uniquement après succès + validation JSON — jamais avant (garde-fou explicite du document).
  const { data: debitOk } = await supabase.rpc('debiter_credit_revision', { p_beneficiaire_id: beneficiaireId })
  if (!debitOk) return { error: 'Solde de crédits insuffisant.' }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: quiz, error } = await supabase
    .from('quiz_revision')
    .insert({
      document_id: documentId,
      beneficiaire_id: beneficiaireId,
      organisation_id: beneficiaire.organisation_id,
      palier: 'payant',
      niveau_difficulte: niveauDifficulte,
      chrono_mode: 'global',
      chrono_duree_sec: 600,
      contenu_json: contenuJson,
      created_by: user?.id,
    })
    .select('id')
    .single()

  if (error || !quiz) return { error: 'Le crédit a été débité mais l’enregistrement du quiz a échoué — contactez le support.' }

  revalidatePath(`/mon-espace/${beneficiaireId}/revisions`)
  return { error: null, quizId: quiz.id }
}

export async function enregistrerTentative(
  quizId: string,
  beneficiaireId: string,
  reponses: Record<string, string>,
  score: number,
  tempsTotalSec: number,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const beneficiaire = await chargerBeneficiaire(supabase, beneficiaireId)
  if (!beneficiaire) return { error: 'Bénéficiaire introuvable.' }

  const { error } = await supabase.from('quiz_revision_tentatives').insert({
    quiz_revision_id: quizId,
    beneficiaire_id: beneficiaireId,
    organisation_id: beneficiaire.organisation_id,
    reponses_json: reponses,
    score,
    temps_total_sec: tempsTotalSec,
  })
  if (error) return { error: 'Impossible d’enregistrer cette tentative.' }

  revalidatePath(`/mon-espace/${beneficiaireId}/revisions`)
  return { error: null }
}

/** Mot de reconnaissance du formateur (§9, v3) — texte libre saisi manuellement,
 * jamais généré automatiquement. Réservé à l'équipe pédagogique. */
export async function ajouterNoteEncouragement(beneficiaireId: string, formData: FormData): Promise<void> {
  const message = String(formData.get('message') ?? '').trim()
  if (!message) return

  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  const beneficiaire = await chargerBeneficiaire(supabase, beneficiaireId)
  if (!beneficiaire) return

  if (!estFondateur) {
    const { data: peutCreer } = await supabase.rpc('peut_creer', { p_module: 'notes_encouragement_revision', p_organisation_id: beneficiaire.organisation_id })
    if (!peutCreer) return
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('notes_encouragement_revision').insert({
    beneficiaire_id: beneficiaireId,
    organisation_id: beneficiaire.organisation_id,
    message,
    created_by: user?.id,
  })

  revalidatePath(`/mon-espace/${beneficiaireId}/revisions`)
}

export async function marquerNoteEncouragementVue(beneficiaireId: string, noteId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('notes_encouragement_revision').update({ affichee_at: new Date().toISOString() }).eq('id', noteId)
  revalidatePath(`/mon-espace/${beneficiaireId}/revisions`)
}
