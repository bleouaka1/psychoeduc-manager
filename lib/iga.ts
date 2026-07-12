/** Logique IGA multi-référentiel (E/A/J/AD) en TypeScript standard — calcul et
 * suggestion découplés du fournisseur cloud (principe absolu du projet, cf.
 * lib/marketplaceAutoPublish.ts pour le même pattern). Aucune dépendance DB ici :
 * testable en isolation. */

export type CodeReferentielIga = 'iga_e' | 'iga_a' | 'iga_j' | 'iga_ad'

/** Suggestion par âge — le praticien reste toujours libre de choisir un autre
 * référentiel (chevauchement 18-25 entre IGA-A et IGA-J résolu par le jugement
 * humain, pas par une règle automatique rigide, cf. PLAN_IGA_MULTI_REFERENTIEL.md). */
/** Réutilisé au-delà de l'IGA (ex. vérification d'âge des Cercles d'apprentissage,
 * lib/cerclesApprentissage.ts) — équivalent TypeScript de la fonction SQL
 * `calculer_age()` (Étape 5), pour la même logique côté client sans aller-retour DB. */
export function calculerAgeAns(dateNaissance: Date | string | null): number | null {
  if (!dateNaissance) return null
  const naissance = typeof dateNaissance === 'string' ? new Date(dateNaissance) : dateNaissance
  const aujourdHui = new Date()
  let age = aujourdHui.getFullYear() - naissance.getFullYear()
  const moisDiff = aujourdHui.getMonth() - naissance.getMonth()
  if (moisDiff < 0 || (moisDiff === 0 && aujourdHui.getDate() < naissance.getDate())) age--
  return age
}

export function suggererReferentiel(dateNaissance: Date | string | null): CodeReferentielIga {
  const age = calculerAgeAns(dateNaissance)
  if (age == null) return 'iga_j'
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

/** Conseils génériques automatiques par dimension faible (§3 du document Mécanisme
 * IGA→Marketplace) — texte statique, pas de génération IA. Un même code de dimension
 * peut apparaître dans plusieurs référentiels avec un libellé légèrement différent ;
 * le conseil reste valable dans les deux cas. */
export const CONSEIL_GENERIQUE_PAR_DIMENSION: Record<string, string> = {
  autonomie_economique: 'Apprendre à établir un budget simple, ouvrir un compte d’épargne même modeste, et suivre ses dépenses régulièrement.',
  logement: 'Explorer les options de logement autonome adaptées au budget, et sécuriser progressivement les charges courantes (loyer, eau, électricité).',
  emploi_activite: 'Identifier une activité stable, même modeste au départ, et construire une régularité de revenu avant de viser l’évolution.',
  sante: 'Consulter un suivi médical régulier, même préventif, et rétablir des habitudes de sommeil/alimentation stables.',
  vie_citoyenne: 'Régulariser les documents administratifs essentiels en priorité, puis explorer une participation communautaire simple.',
  relations_affectives: 'Identifier une personne de confiance pour un soutien relationnel, et travailler la communication dans les relations proches.',
  parentalite: 'Se rapprocher d’un accompagnement parental si besoin, et sécuriser d’abord les besoins matériels de base de l’enfant.',
  developpement_professionnel: 'Suivre une formation continue ciblée, et se constituer un réseau professionnel actif même restreint au départ.',
  developpement_personnel: 'Travailler la gestion des émotions et la confiance en soi par des routines simples et un accompagnement adapté.',
  habitudes_de_vie: 'Stabiliser une routine quotidienne simple (hygiène, sommeil, alimentation) avant d’ajouter d’autres objectifs.',
  scolarite: 'Renforcer l’assiduité et la relation avec les enseignants en priorité — la motivation suit souvent une fois le cadre stabilisé.',
  socialisation: 'Favoriser des occasions d’interaction encadrées avec les pairs pour développer progressivement la confiance sociale.',
  vie_familiale: 'Impliquer les figures parentales/tutrices dans le suivi pour stabiliser un environnement familial plus sécurisant.',
  securite: 'Signaler et traiter en priorité tout risque identifié — c’est la base avant tout autre travail d’autonomie.',
  developpement_cognitif: 'Proposer des activités de stimulation adaptées à l’âge, en lien avec l’école ou un accompagnement spécialisé.',
  autonomie_personnelle: 'Reprendre les gestes du quotidien un à un, avec des routines simples et des rappels progressivement espacés.',
  autonomie_sociale: 'Multiplier les occasions de travail en groupe encadré pour développer la communication et la gestion des conflits.',
  autonomie_educative_professionnelle: 'Renforcer l’assiduité et la qualité du travail avant de viser l’initiative et l’autonomie complète.',
  insertion_socioprofessionnelle: 'Construire un CV simple et préparer un entretien type — commencer par une recherche de stage courte et encadrée.',
  capital_social: 'Identifier 2-3 personnes ressources fiables (famille, éducateurs, pairs) sur qui s’appuyer en cas de besoin.',
  situation_financiere: 'Faire un état des lieux complet des dettes et revenus, puis établir un plan de stabilisation réaliste.',
  reseau_social: 'Réactiver des liens existants avant d’en construire de nouveaux — la qualité prime sur le nombre.',
  gestion_administrative: 'Établir une check-list des obligations administratives en retard et les traiter une par une.',
  bien_etre_psychologique: 'Identifier une personne ou un professionnel de confiance à solliciter en cas de besoin, avant que la difficulté ne s’aggrave.',
  preparation_avenir: 'Formaliser un projet à long terme simple, même modeste, plutôt que de repousser toute anticipation.',
}

export const REFERENTIEL_LABEL: Record<CodeReferentielIga, string> = {
  iga_e: 'IGA-E — Enfance (0-12 ans)',
  iga_a: 'IGA-A — Adolescents/Jeunes (13-25 ans)',
  iga_j: 'IGA-J — Jeunes adultes (18-35 ans)',
  iga_ad: 'IGA-AD — Adultes (35 ans et plus)',
}
