import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReponseNotion } from '@/lib/quizRevisionEncouragement'

/** Fonctions de lecture pour le module Quiz de révision — partagées entre la page
 * bénéficiaire (/mon-espace/[id]/revisions) et une éventuelle vue équipe pédagogique
 * future. Aucune écriture ici (voir actions.ts de chaque route). */

export type DocumentQuiz = {
  id: string
  nomFichier: string
  typeSource: string
  contenuTexte: string | null
  valideParNom: string | null
  valideAt: string | null
  createdAt: string
}

export async function chargerDocumentsQuiz(supabase: SupabaseClient, beneficiaireId: string): Promise<DocumentQuiz[]> {
  const { data } = await supabase
    .from('documents_beneficiaires')
    .select('id, nom_fichier, type_source, contenu_texte, valide_at, created_at, valide_par:profiles!documents_beneficiaires_valide_par_fkey(nom, prenoms)')
    .eq('beneficiaire_id', beneficiaireId)
    .not('type_source', 'is', null)
    .order('created_at', { ascending: false })

  return (data ?? []).map((d: any) => ({
    id: d.id,
    nomFichier: d.nom_fichier,
    typeSource: d.type_source,
    contenuTexte: d.contenu_texte,
    valideParNom: d.valide_par ? `${d.valide_par.prenoms ?? ''} ${d.valide_par.nom ?? ''}`.trim() : null,
    valideAt: d.valide_at,
    createdAt: d.created_at,
  }))
}

export type QuizAffiche = {
  id: string
  documentId: string
  documentNom: string
  palier: 'gratuit' | 'payant'
  niveauDifficulte: string
  createdAt: string
  meilleurScore: number | null
}

export async function chargerQuizzes(supabase: SupabaseClient, beneficiaireId: string): Promise<QuizAffiche[]> {
  const { data: quizzes } = await supabase
    .from('quiz_revision')
    .select('id, document_id, palier, niveau_difficulte, created_at, documents_beneficiaires(nom_fichier)')
    .eq('beneficiaire_id', beneficiaireId)
    .order('created_at', { ascending: false })

  if (!quizzes || quizzes.length === 0) return []

  const { data: tentatives } = await supabase
    .from('quiz_revision_tentatives')
    .select('quiz_revision_id, score')
    .eq('beneficiaire_id', beneficiaireId)
    .in(
      'quiz_revision_id',
      quizzes.map((q: any) => q.id),
    )

  const meilleurScoreParQuiz = new Map<string, number>()
  for (const t of tentatives ?? []) {
    const actuel = meilleurScoreParQuiz.get(t.quiz_revision_id) ?? -1
    if (Number(t.score) > actuel) meilleurScoreParQuiz.set(t.quiz_revision_id, Number(t.score))
  }

  return quizzes.map((q: any) => ({
    id: q.id,
    documentId: q.document_id,
    documentNom: q.documents_beneficiaires?.nom_fichier ?? 'Document',
    palier: q.palier,
    niveauDifficulte: q.niveau_difficulte,
    createdAt: q.created_at,
    meilleurScore: meilleurScoreParQuiz.get(q.id) ?? null,
  }))
}

export async function chargerSoldeCredits(supabase: SupabaseClient, beneficiaireId: string): Promise<number> {
  const { data } = await supabase.from('credits_revision').select('solde').eq('beneficiaire_id', beneficiaireId).maybeSingle()
  return data?.solde ?? 0
}

export async function chargerDatesCompletion(supabase: SupabaseClient, beneficiaireId: string): Promise<Date[]> {
  const { data } = await supabase.from('quiz_revision_tentatives').select('completed_at').eq('beneficiaire_id', beneficiaireId)
  return (data ?? []).map((t: any) => new Date(t.completed_at))
}

/** Résout chaque réponse donnée (reponses_json) en notion (le terme testé, stable
 * même si le quiz est régénéré) + correcte/incorrecte, en croisant avec le contenu
 * du quiz au moment de la tentative — nécessaire car reponses_json ne stocke que
 * l'id de question et la réponse donnée, pas le jugement. */
export async function chargerReponsesNotions(supabase: SupabaseClient, beneficiaireId: string): Promise<ReponseNotion[]> {
  const { data: tentatives } = await supabase
    .from('quiz_revision_tentatives')
    .select('reponses_json, completed_at, quiz_revision:quiz_revision_id(contenu_json)')
    .eq('beneficiaire_id', beneficiaireId)
    .order('completed_at', { ascending: true })

  const reponses: ReponseNotion[] = []
  for (const t of tentatives ?? []) {
    const questions = (t as any).quiz_revision?.contenu_json?.questions ?? []
    const questionsParId = new Map<string, any>(questions.map((q: any) => [q.id, q]))
    const reponsesDonnees = (t as any).reponses_json ?? {}
    for (const [questionId, reponseDonnee] of Object.entries(reponsesDonnees)) {
      const question = questionsParId.get(questionId)
      if (!question) continue
      reponses.push({
        notion: question.reponseCorrecte,
        correcte: reponseDonnee === question.reponseCorrecte,
        date: new Date((t as any).completed_at),
      })
    }
  }
  return reponses
}

/** Moyenne des scores de tentatives — signal "Savoirs" affiché à part dans la vue
 * Profil professionnel (handoff-icc-cv-navigation.md §1), jamais fusionné dans
 * icc_evaluations_savoir : ce sont deux référentiels distincts (l'un déclaratif par
 * le formateur, l'autre mesuré par quiz), les confondre en un seul chiffre masquerait
 * leur origine et donnerait un faux sentiment de précision. */
export async function chargerScoreMoyenQuiz(supabase: SupabaseClient, beneficiaireId: string): Promise<number | null> {
  const { data } = await supabase.from('quiz_revision_tentatives').select('score').eq('beneficiaire_id', beneficiaireId)
  if (!data || data.length === 0) return null
  const moyenne = data.reduce((acc, t: any) => acc + Number(t.score), 0) / data.length
  return Math.round(moyenne * 10) / 10
}

export type NoteEncouragement = { id: string; message: string; createdAt: string }

export async function chargerNoteEncouragementNonVue(supabase: SupabaseClient, beneficiaireId: string): Promise<NoteEncouragement | null> {
  const { data } = await supabase
    .from('notes_encouragement_revision')
    .select('id, message, created_at')
    .eq('beneficiaire_id', beneficiaireId)
    .is('affichee_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? { id: data.id, message: data.message, createdAt: data.created_at } : null
}
