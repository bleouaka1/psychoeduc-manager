import type { SupabaseClient } from '@supabase/supabase-js'
import { calculerIcc, type ScoreIcc, type EvaluationSavoir, type EvaluationSavoirFaire, type NiveauSavoirFaire } from './icc'

/** Agrège les données réelles nécessaires aux 3 piliers ICC, groupées par formation
 * (§4.1 : "propre à la formation en cours") — délègue tout le calcul à `calculerIcc`
 * (pur, lib/icc.ts), jamais de logique de pondération ici.
 *
 * Enrichissement (dashboard bénéficiaire v2, Lot B) : au-delà du score agrégé (%),
 * expose aussi le libellé concret de chaque compétence validée — le prompt source
 * demande des phrases type "Tu sais X", mais `icc_competences.libelle` est un texte
 * libre saisi par le formateur (ex. "Utilisation du rabot"), pas une phrase grammaticale
 * garantie ("Tu sais Utilisation du rabot" serait incorrect) : plutôt que de tenter une
 * conjugaison automatique risquée sur du texte arbitraire, chaque libellé est affiché
 * comme un constat factuel étiqueté ("Compétence validée : Utilisation du rabot"), sûr
 * quel que soit le texte saisi. Seul le Savoir-être a un référentiel fixe et connu
 * (TAGS_SAVOIR_ETRE, 5 valeurs) : là seulement, une vraie phrase par tag est possible
 * (cf. PHRASE_SAVOIR_ETRE, lib/icc.ts) sans risque grammatical. */

export type CompetenceSavoirDetail = { libelle: string; maitrise: boolean }
export type CompetenceSavoirFaireDetail = { libelle: string; niveau: NiveauSavoirFaire }

export type IccFormation = {
  formationId: string
  formationTitre: string
  score: ScoreIcc
  competencesSavoir: CompetenceSavoirDetail[]
  competencesSavoirFaire: CompetenceSavoirFaireDetail[]
  tagsSavoirEtre: string[]
}

export async function chargerFormationsAvecIcc(supabase: SupabaseClient, beneficiaireId: string): Promise<IccFormation[]> {
  const [{ data: savoirs }, { data: savoirFaires }, { data: observations }] = await Promise.all([
    supabase
      .from('icc_evaluations_savoir')
      .select('moment, maitrise, icc_competences(id, libelle, formation_id, formations(titre))')
      .eq('beneficiaire_id', beneficiaireId),
    supabase
      .from('icc_evaluations_savoir_faire')
      .select('niveau, icc_competences(id, libelle, formation_id, formations(titre))')
      .eq('beneficiaire_id', beneficiaireId),
    supabase.from('icc_observations_savoir_etre').select('tag, formation_id, formations(titre)').eq('beneficiaire_id', beneficiaireId),
  ])

  const formations = new Map<
    string,
    { titre: string; savoirs: EvaluationSavoir[]; savoirFaires: EvaluationSavoirFaire[]; tags: string[]; libellesSavoir: Map<string, string>; libellesSavoirFaire: Map<string, string> }
  >()

  const entree = (formationId: string, titre: string) => {
    if (!formations.has(formationId)) {
      formations.set(formationId, { titre, savoirs: [], savoirFaires: [], tags: [], libellesSavoir: new Map(), libellesSavoirFaire: new Map() })
    }
    return formations.get(formationId)!
  }

  // Savoirs : une ligne par (compétence, moment) -> regrouper avant/après par compétence
  const savoirParCompetence = new Map<string, { avant: boolean | null; apres: boolean | null; formationId: string; titre: string; libelle: string }>()
  for (const s of (savoirs ?? []) as any[]) {
    const competence = s.icc_competences
    if (!competence) continue
    const cle = competence.id
    const existant =
      savoirParCompetence.get(cle) ?? { avant: null, apres: null, formationId: competence.formation_id, titre: competence.formations?.titre ?? '', libelle: competence.libelle }
    if (s.moment === 'avant') existant.avant = s.maitrise
    else existant.apres = s.maitrise
    savoirParCompetence.set(cle, existant)
  }
  for (const [competenceId, s] of savoirParCompetence) {
    const f = entree(s.formationId, s.titre)
    f.savoirs.push({ competenceId, avant: s.avant, apres: s.apres })
    f.libellesSavoir.set(competenceId, s.libelle)
  }

  for (const sf of (savoirFaires ?? []) as any[]) {
    const competence = sf.icc_competences
    if (!competence) continue
    const f = entree(competence.formation_id, competence.formations?.titre ?? '')
    f.savoirFaires.push({ competenceId: competence.id, niveau: sf.niveau as NiveauSavoirFaire })
    f.libellesSavoirFaire.set(competence.id, competence.libelle)
  }

  for (const o of (observations ?? []) as any[]) {
    entree(o.formation_id, o.formations?.titre ?? '').tags.push(o.tag)
  }

  return Array.from(formations.entries()).map(([formationId, f]) => ({
    formationId,
    formationTitre: f.titre,
    score: calculerIcc(f.savoirs, f.savoirFaires, f.tags),
    competencesSavoir: f.savoirs
      .filter((s) => s.apres === true)
      .map((s) => ({ libelle: f.libellesSavoir.get(s.competenceId) ?? '', maitrise: true }))
      .filter((c) => c.libelle),
    competencesSavoirFaire: f.savoirFaires.map((sf) => ({ libelle: f.libellesSavoirFaire.get(sf.competenceId) ?? '', niveau: sf.niveau })).filter((c) => c.libelle),
    tagsSavoirEtre: Array.from(new Set(f.tags)),
  }))
}
