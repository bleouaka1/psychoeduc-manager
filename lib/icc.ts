/** ICC (Indice de Compétences du Bénéficiaire) — 3 sous-scores, calcul en
 * TypeScript standard (logique métier découplée du fournisseur cloud, même
 * principe que lib/iga.ts, lib/ipp.ts). Réf : CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md §4.
 *
 * Garde-fou méthodologique (§4.3, respecté à la lettre) : le référentiel de
 * Savoirs/Savoir-faire est local à CHAQUE formation, défini par le formateur qui
 * la crée — ce module ne connaît jamais de "référentiel métier officiel".
 * L'ICC n'entre jamais dans le calcul de l'IPP du formateur (lib/ipp.ts) : ce
 * n'est pas un outil de notation du praticien, seulement un bulletin de
 * progression pour le bénéficiaire (et les employeurs). */

export type EvaluationSavoir = { competenceId: string; avant: boolean | null; apres: boolean | null }
export type NiveauSavoirFaire = 'debutant' | 'intermediaire' | 'autonome' | 'expert'
export type EvaluationSavoirFaire = { competenceId: string; niveau: NiveauSavoirFaire }

const POINTS_PAR_NIVEAU: Record<NiveauSavoirFaire, number> = { debutant: 25, intermediaire: 50, autonome: 75, expert: 100 }

/** Score = part des compétences "maîtrisées après" sur le total du référentiel de
 * la formation — pas un delta avant/après (l'avant sert de point de comparaison
 * affiché, pas une pondération du score, cf. lib/iccServer.ts pour l'affichage). */
export function calculerScoreSavoirs(evaluations: EvaluationSavoir[]): number | null {
  if (evaluations.length === 0) return null
  const maitrisesApres = evaluations.filter((e) => e.apres === true).length
  return Math.round((maitrisesApres / evaluations.length) * 100 * 10) / 10
}

export function calculerScoreSavoirFaire(evaluations: EvaluationSavoirFaire[]): number | null {
  if (evaluations.length === 0) return null
  const total = evaluations.reduce((acc, e) => acc + POINTS_PAR_NIVEAU[e.niveau], 0)
  return Math.round((total / evaluations.length) * 10) / 10
}

/** Savoir-être : le document (§4.2.3) suppose une réutilisation directe des tags
 * de comportement déjà saisis dans les fiches entretien spécialisées — vérifié
 * inadapté dans ce projet (ces tags sont des signaux cliniques de vigilance, pas
 * des observations de compétence positive, cf. DECISIONS_LOG.md). Ce score se
 * base donc sur `icc_observations_savoir_etre`, un référentiel fixe et positif de
 * tags dédié, alimenté par le praticien. Score = part des tags du référentiel
 * observés au moins une fois pour cette formation. */
export const TAGS_SAVOIR_ETRE = ['Ponctualité', 'Assiduité', 'Autonomie', 'Travail en équipe', 'Communication'] as const

/** Phrase concrète par tag (dashboard bénéficiaire v2, Lot B) — possible ici sans risque
 * grammatical car TAGS_SAVOIR_ETRE est un référentiel FIXE et connu (5 valeurs), à la
 * différence des libellés Savoirs/Savoir-faire (texte libre du formateur, cf.
 * lib/iccServer.ts pour pourquoi ceux-là ne sont jamais auto-conjugués). */
export const PHRASE_SAVOIR_ETRE: Record<(typeof TAGS_SAVOIR_ETRE)[number], string> = {
  Ponctualité: 'Tu es ponctuel(le)',
  Assiduité: 'Tu es assidu(e)',
  Autonomie: 'Tu fais preuve d’autonomie',
  'Travail en équipe': 'Tu travailles bien en équipe',
  Communication: 'Tu communiques clairement',
}

export function calculerScoreSavoirEtre(tagsObserves: string[]): number | null {
  if (tagsObserves.length === 0) return null
  const distincts = new Set(tagsObserves.filter((t) => (TAGS_SAVOIR_ETRE as readonly string[]).includes(t)))
  return Math.round((distincts.size / TAGS_SAVOIR_ETRE.length) * 100 * 10) / 10
}

export type ScoreIcc = { savoirs: number | null; savoirFaire: number | null; savoirEtre: number | null }

export function calculerIcc(evaluationsSavoir: EvaluationSavoir[], evaluationsSavoirFaire: EvaluationSavoirFaire[], tagsSavoirEtreObserves: string[]): ScoreIcc {
  return {
    savoirs: calculerScoreSavoirs(evaluationsSavoir),
    savoirFaire: calculerScoreSavoirFaire(evaluationsSavoirFaire),
    savoirEtre: calculerScoreSavoirEtre(tagsSavoirEtreObserves),
  }
}

/** Agrège les scores ICC de toutes les formations d'un bénéficiaire en une seule
 * lecture (handoff-icc-cv-navigation.md §1, vue "Profil professionnel") — moyenne
 * simple des formations où la dimension a une valeur, jamais une pondération par
 * durée/importance de formation (aucun référentiel officiel ne justifierait un tel
 * poids, cf. note méthodologique en tête de fichier). */
export function agregerScoresIcc(scores: ScoreIcc[]): ScoreIcc {
  const moyenne = (valeurs: (number | null)[]): number | null => {
    const presentes = valeurs.filter((v): v is number => v != null)
    if (presentes.length === 0) return null
    return Math.round((presentes.reduce((a, b) => a + b, 0) / presentes.length) * 10) / 10
  }
  return {
    savoirs: moyenne(scores.map((s) => s.savoirs)),
    savoirFaire: moyenne(scores.map((s) => s.savoirFaire)),
    savoirEtre: moyenne(scores.map((s) => s.savoirEtre)),
  }
}
