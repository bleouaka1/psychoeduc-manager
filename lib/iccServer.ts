import type { SupabaseClient } from '@supabase/supabase-js'
import { calculerIcc, type ScoreIcc, type EvaluationSavoir, type EvaluationSavoirFaire, type NiveauSavoirFaire } from './icc'

/** Agrège les données réelles nécessaires aux 3 piliers ICC, groupées par formation
 * (§4.1 : "propre à la formation en cours") — délègue tout le calcul à `calculerIcc`
 * (pur, lib/icc.ts), jamais de logique de pondération ici. */

export type IccFormation = { formationId: string; formationTitre: string; score: ScoreIcc }

export async function chargerFormationsAvecIcc(supabase: SupabaseClient, beneficiaireId: string): Promise<IccFormation[]> {
  const [{ data: savoirs }, { data: savoirFaires }, { data: observations }] = await Promise.all([
    supabase
      .from('icc_evaluations_savoir')
      .select('moment, maitrise, icc_competences(id, formation_id, formations(titre))')
      .eq('beneficiaire_id', beneficiaireId),
    supabase
      .from('icc_evaluations_savoir_faire')
      .select('niveau, icc_competences(id, formation_id, formations(titre))')
      .eq('beneficiaire_id', beneficiaireId),
    supabase.from('icc_observations_savoir_etre').select('tag, formation_id, formations(titre)').eq('beneficiaire_id', beneficiaireId),
  ])

  const formations = new Map<string, { titre: string; savoirs: EvaluationSavoir[]; savoirFaires: EvaluationSavoirFaire[]; tags: string[] }>()

  const entree = (formationId: string, titre: string) => {
    if (!formations.has(formationId)) formations.set(formationId, { titre, savoirs: [], savoirFaires: [], tags: [] })
    return formations.get(formationId)!
  }

  // Savoirs : une ligne par (compétence, moment) -> regrouper avant/après par compétence
  const savoirParCompetence = new Map<string, { avant: boolean | null; apres: boolean | null; formationId: string; titre: string }>()
  for (const s of (savoirs ?? []) as any[]) {
    const competence = s.icc_competences
    if (!competence) continue
    const cle = competence.id
    const existant = savoirParCompetence.get(cle) ?? { avant: null, apres: null, formationId: competence.formation_id, titre: competence.formations?.titre ?? '' }
    if (s.moment === 'avant') existant.avant = s.maitrise
    else existant.apres = s.maitrise
    savoirParCompetence.set(cle, existant)
  }
  for (const [competenceId, s] of savoirParCompetence) {
    entree(s.formationId, s.titre).savoirs.push({ competenceId, avant: s.avant, apres: s.apres })
  }

  for (const sf of (savoirFaires ?? []) as any[]) {
    const competence = sf.icc_competences
    if (!competence) continue
    entree(competence.formation_id, competence.formations?.titre ?? '').savoirFaires.push({ competenceId: competence.id, niveau: sf.niveau as NiveauSavoirFaire })
  }

  for (const o of (observations ?? []) as any[]) {
    entree(o.formation_id, o.formations?.titre ?? '').tags.push(o.tag)
  }

  return Array.from(formations.entries()).map(([formationId, f]) => ({
    formationId,
    formationTitre: f.titre,
    score: calculerIcc(f.savoirs, f.savoirFaires, f.tags),
  }))
}
