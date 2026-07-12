import type { SupabaseClient } from '@supabase/supabase-js'
import { REFERENTIEL_LABEL, type CodeReferentielIga } from './iga'

/** Chargement des données du tableau de bord bénéficiaire (CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md).
 * Toute la lecture repose sur les policies RLS déjà en place (beneficiaires.profile_id = auth.uid(),
 * répercutée sur evaluations_iga/scores_iga) — jamais de vérification d'appartenance dupliquée ici. */

export type DossierBeneficiaire = { id: string; nom: string; prenoms: string; organisationNom: string }

export async function chargerDossiersBeneficiaire(supabase: SupabaseClient): Promise<DossierBeneficiaire[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase.from('beneficiaires').select('id, nom, prenoms, organisations(nom)').eq('profile_id', user.id)
  return (data ?? []).map((b: any) => ({ id: b.id, nom: b.nom, prenoms: b.prenoms, organisationNom: b.organisations?.nom ?? '' }))
}

export type DimensionRadar = { nom: string; score: number }

export type BoussoleAutonomie = {
  scoreGlobal: number | null
  niveau: string | null
  dateEvaluation: string | null
  referentielLabel: string | null
  dimensions: DimensionRadar[]
}

/** Le radar affiche le nombre réel de dimensions du référentiel actif du
 * bénéficiaire (7 pour IGA-E, 6 pour IGA-A, 8 pour IGA-J/AD) plutôt qu'un total
 * de 8 forcé arbitrairement — écart assumé, cf. PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md. */
export async function chargerBoussoleAutonomie(supabase: SupabaseClient, beneficiaireId: string): Promise<BoussoleAutonomie> {
  const { data: derniereEval } = await supabase
    .from('evaluations_iga')
    .select('id, score_global, niveau, date_evaluation, referentiels_iga(code)')
    .eq('beneficiaire_id', beneficiaireId)
    .order('date_evaluation', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!derniereEval) {
    return { scoreGlobal: null, niveau: null, dateEvaluation: null, referentielLabel: null, dimensions: [] }
  }

  const { data: scores } = await supabase
    .from('scores_iga')
    .select('score, dimensions_iga(nom, ordre)')
    .eq('evaluation_id', derniereEval.id)
    .order('ordre', { referencedTable: 'dimensions_iga' })

  const code = (derniereEval as any).referentiels_iga?.code as CodeReferentielIga | undefined

  return {
    scoreGlobal: derniereEval.score_global,
    niveau: derniereEval.niveau,
    dateEvaluation: derniereEval.date_evaluation,
    referentielLabel: code ? REFERENTIEL_LABEL[code] : null,
    dimensions: (scores ?? []).map((s: any) => ({ nom: s.dimensions_iga?.nom ?? '', score: Number(s.score) })),
  }
}
