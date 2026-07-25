import type { SupabaseClient } from '@supabase/supabase-js'

/** "Reprendre mon activité" (dashboard bénéficiaire v3) — dernière activité réelle par
 * module, jamais une valeur fictive : chaque carte est simplement absente si aucune
 * donnée réelle ne justifie de l'afficher (pas de "0%" ou de titre inventé). */

export type ActiviteApprentissage = { formationTitre: string; chapitreTitre: string | null; pourcentage: number; inscriptionId: string }
export type ActiviteTuteur = { sessionId: string; personaNom: string; domaine: string }
export type ActiviteRevisions = { quizId: string; documentNom: string; meilleurScore: number | null }
export type ActiviteSessionPro = { sessionId: string; personaNom: string }

export async function chargerActiviteApprentissage(supabase: SupabaseClient, profileId: string): Promise<ActiviteApprentissage | null> {
  const { data: progression } = await supabase
    .from('vue_progression_formations')
    .select('inscription_id, formation_id, pourcentage, formations(titre)')
    .eq('acheteur_id', profileId)
    .lt('pourcentage', 100)
    .order('inscription_id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!progression) return null

  // Tri par ordre de chapitre effectué côté client : PostgREST n'accepte pas de
  // trier sur une colonne d'une ressource imbriquée (cours(ordre)) de façon fiable.
  const { data: coursIncomplets } = await supabase
    .from('progression_formation')
    .select('cours(titre, ordre)')
    .eq('inscription_id', progression.inscription_id)
    .eq('complete', false)
  const prochainCours = ((coursIncomplets ?? []) as any[])
    .map((c) => c.cours)
    .filter(Boolean)
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))[0]

  return {
    inscriptionId: progression.inscription_id,
    formationTitre: (progression as any).formations?.titre ?? 'Formation',
    chapitreTitre: prochainCours?.titre ?? null,
    pourcentage: Number(progression.pourcentage),
  }
}

export async function chargerActiviteTuteur(supabase: SupabaseClient, beneficiaireId: string): Promise<ActiviteTuteur | null> {
  const { data } = await supabase
    .from('tuteur_sessions')
    .select('id, tuteur_personas(nom, domaine, objectif)')
    .eq('beneficiaire_id', beneficiaireId)
    .eq('statut', 'active')
    .order('created_at', { ascending: false })
    .limit(20)
  const session = ((data ?? []) as any[]).find((s) => s.tuteur_personas?.objectif === 'tutorat')
  if (!session) return null
  return { sessionId: session.id, personaNom: session.tuteur_personas.nom, domaine: session.tuteur_personas.domaine }
}

export async function chargerActiviteSessionPro(supabase: SupabaseClient, beneficiaireId: string): Promise<ActiviteSessionPro | null> {
  const { data } = await supabase
    .from('tuteur_sessions')
    .select('id, tuteur_personas(nom, objectif)')
    .eq('beneficiaire_id', beneficiaireId)
    .eq('statut', 'active')
    .order('created_at', { ascending: false })
    .limit(20)
  const session = ((data ?? []) as any[]).find((s) => s.tuteur_personas?.objectif === 'entretien')
  if (!session) return null
  return { sessionId: session.id, personaNom: session.tuteur_personas.nom }
}

export async function chargerActiviteRevisions(supabase: SupabaseClient, beneficiaireId: string): Promise<ActiviteRevisions | null> {
  const { data: quiz } = await supabase
    .from('quiz_revision')
    .select('id, documents_beneficiaires(nom_fichier)')
    .eq('beneficiaire_id', beneficiaireId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!quiz) return null

  const { data: tentatives } = await supabase.from('quiz_revision_tentatives').select('score').eq('quiz_revision_id', quiz.id).order('score', { ascending: false }).limit(1)

  return {
    quizId: quiz.id,
    documentNom: (quiz as any).documents_beneficiaires?.nom_fichier ?? 'Document',
    meilleurScore: tentatives && tentatives.length > 0 ? Number(tentatives[0].score) : null,
  }
}
