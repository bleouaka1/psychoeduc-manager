import type { SupabaseClient } from '@supabase/supabase-js'

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
