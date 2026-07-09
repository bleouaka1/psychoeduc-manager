/** Logique IGA multi-référentiel (E/A/J/AD) en TypeScript standard — calcul et
 * suggestion découplés du fournisseur cloud (principe absolu du projet, cf.
 * lib/marketplaceAutoPublish.ts pour le même pattern). Aucune dépendance DB ici :
 * testable en isolation. */

export type CodeReferentielIga = 'iga_e' | 'iga_a' | 'iga_j' | 'iga_ad'

/** Suggestion par âge — le praticien reste toujours libre de choisir un autre
 * référentiel (chevauchement 18-25 entre IGA-A et IGA-J résolu par le jugement
 * humain, pas par une règle automatique rigide, cf. PLAN_IGA_MULTI_REFERENTIEL.md). */
export function suggererReferentiel(dateNaissance: Date | string | null): CodeReferentielIga {
  if (!dateNaissance) return 'iga_j'
  const naissance = typeof dateNaissance === 'string' ? new Date(dateNaissance) : dateNaissance
  const aujourdHui = new Date()
  let age = aujourdHui.getFullYear() - naissance.getFullYear()
  const moisDiff = aujourdHui.getMonth() - naissance.getMonth()
  if (moisDiff < 0 || (moisDiff === 0 && aujourdHui.getDate() < naissance.getDate())) age--

  if (age <= 12) return 'iga_e'
  if (age <= 17) return 'iga_a'
  if (age <= 35) return 'iga_j'
  return 'iga_ad'
}

export type IndicateurSaisi = {
  critereId: string
  dimensionId: string
  scoreBrut: number // 0 à 4
  poidsCritere: number
}

export type ScoreDimension = {
  dimensionId: string
  score: number // sur 100, proportionnel au poids de la dimension
}

/** Calcule le score par dimension (somme pondérée des critères, ramenée sur 100)
 * et le score global (somme des scores de dimension, déjà pondérés par leur
 * propre poids dans le référentiel — donc la somme des `poids` de dimension = 100). */
export function calculerScoreEvaluation(
  indicateurs: IndicateurSaisi[],
  dimensions: { id: string; poids: number }[],
): { scoresParDimension: ScoreDimension[]; scoreGlobal: number } {
  const scoresParDimension: ScoreDimension[] = dimensions.map((dim) => {
    const indicateursDim = indicateurs.filter((i) => i.dimensionId === dim.id)
    const poidsTotalCriteres = indicateursDim.reduce((acc, i) => acc + i.poidsCritere, 0)
    if (poidsTotalCriteres === 0) return { dimensionId: dim.id, score: 0 }

    // points obtenus sur le total de points de la dimension (ex. /20), ramenés sur 100
    const pointsObtenus = indicateursDim.reduce((acc, i) => acc + (i.scoreBrut / 4) * i.poidsCritere, 0)
    const scoreSur100 = (pointsObtenus / poidsTotalCriteres) * 100
    return { dimensionId: dim.id, score: Math.round(scoreSur100 * 10) / 10 }
  })

  const poidsTotalDimensions = dimensions.reduce((acc, d) => acc + d.poids, 0) || 100
  const scoreGlobal = scoresParDimension.reduce((acc, s) => {
    const dim = dimensions.find((d) => d.id === s.dimensionId)
    if (!dim) return acc
    return acc + (s.score * dim.poids) / poidsTotalDimensions
  }, 0)

  return { scoresParDimension, scoreGlobal: Math.round(scoreGlobal * 10) / 10 }
}

/** Grille d'interprétation commune aux 4 référentiels (identique dans les 4 fiches). */
export function niveauDepuisScore(scoreGlobal: number): 'dependance' | 'autonomie_emergente' | 'autonomie_fonctionnelle' | 'autonomie_avancee' | 'leadership_autonome' {
  if (scoreGlobal <= 20) return 'dependance'
  if (scoreGlobal <= 40) return 'autonomie_emergente'
  if (scoreGlobal <= 60) return 'autonomie_fonctionnelle'
  if (scoreGlobal <= 80) return 'autonomie_avancee'
  return 'leadership_autonome'
}

/** Réutilise l'enum existant (`evaluations_iga.niveau`) avec les libellés des
 * nouvelles fiches — pas de migration destructive du enum pour un changement de
 * libellé seul (cf. PLAN_IGA_MULTI_REFERENTIEL.md). */
export const NIVEAU_LABEL: Record<string, string> = {
  dependance: 'Dépendance critique',
  autonomie_emergente: 'Faible autonomie',
  autonomie_fonctionnelle: 'Autonomie en développement',
  autonomie_avancee: 'Autonomie satisfaisante',
  leadership_autonome: 'Autonomie élevée',
}

export const REFERENTIEL_LABEL: Record<CodeReferentielIga, string> = {
  iga_e: 'IGA-E — Enfance (0-12 ans)',
  iga_a: 'IGA-A — Adolescents/Jeunes (13-25 ans)',
  iga_j: 'IGA-J — Jeunes adultes (18-35 ans)',
  iga_ad: 'IGA-AD — Adultes (35 ans et plus)',
}
