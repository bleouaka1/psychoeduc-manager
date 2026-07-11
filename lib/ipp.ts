/** IPP (Indice de Performance Pédagogique) — 4 piliers, calcul en TypeScript
 * standard (logique métier découplée du fournisseur cloud, même principe que
 * lib/iga.ts, lib/marketplaceAutoPublish.ts). Réf : CLAUDE-CODE-IPP.md.
 *
 * Barèmes explicitement marqués [PLACEHOLDER] : le document source demande de
 * "ne pas générer de seuils arbitraires sans validation humaine" mais aussi de
 * les "définir ultérieurement avec des données réelles" — aucune donnée réelle
 * n'existe encore. Valeurs raisonnables posées ici, à ajuster avec Angenor dès
 * qu'un historique réel de plusieurs formateurs existe (cf. §8 du document). */

export type DeltaAffectation = { scoreDebut: number; scoreFin: number }
export type Objectif = { statut: 'a_venir' | 'en_cours' | 'atteint' }
export type Entretien = { statut: string; dateEntretien: string; donnees: unknown }
export type Avis = { note: number; auteurType: 'beneficiaire' | 'parent_tuteur' }
export type Dossier = { aDiagnosticInitial: boolean; aPlanAccompagnement: boolean; fichesAJour: boolean }

/** [PLACEHOLDER] normalisation delta IGA sur 0-100 : delta=0 -> 50 (neutre),
 * chaque point de delta déplace le score d'autant, borné [0,100]. */
function normaliserDeltaIga(delta: number): number {
  return Math.max(0, Math.min(100, 50 + delta))
}

export function calculerPilierImpactReel(deltas: DeltaAffectation[], objectifs: Objectif[]): number | null {
  if (deltas.length === 0) return null // garde-fou : jamais de zéro par défaut, exclusion pure et simple

  const progressionMoyenne = deltas.reduce((acc, d) => acc + normaliserDeltaIga(d.scoreFin - d.scoreDebut), 0) / deltas.length

  const tauxObjectifs = objectifs.length > 0 ? (objectifs.filter((o) => o.statut === 'atteint').length / objectifs.length) * 100 : 50 // [PLACEHOLDER] neutre si aucun objectif fixé

  // Maintien des progrès : delta moyen positif ou nul sur les affectations -> 100, sinon dégradé proportionnellement.
  const maintien = deltas.every((d) => d.scoreFin >= d.scoreDebut) ? 100 : 60

  return progressionMoyenne * 0.5 + tauxObjectifs * 0.3 + maintien * 0.2
}

export function calculerPilierQualiteSuivi(entretiens: Entretien[]): number {
  if (entretiens.length === 0) return 0

  const completude = (entretiens.filter((e) => e.statut === 'valide').length / entretiens.length) * 100

  const dates = entretiens.map((e) => new Date(e.dateEntretien).getTime()).sort((a, b) => a - b)
  let ecartMax = 0
  for (let i = 1; i < dates.length; i++) {
    ecartMax = Math.max(ecartMax, (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24))
  }
  const regularite = ecartMax > 30 ? 60 : 100 // pénalité si un écart de plus de 30 jours existe

  return completude * 0.5 + regularite * 0.5
}

export function calculerPilierRigueurDocumentaire(dossiers: Dossier[]): number {
  if (dossiers.length === 0) return 0
  const complets = dossiers.filter((d) => d.aDiagnosticInitial && d.aPlanAccompagnement && d.fichesAJour).length
  return (complets / dossiers.length) * 100
}

/** Pondération mineur/parent (§6.2 du document, 70%/30%) appliquée par avis
 * plutôt que par appariement jalon-par-jalon (simplification documentée — un
 * appariement précis nécessiterait de lier explicitement chaque réponse mineur
 * à sa réponse parent correspondante, non construit dans cette V1). */
export function calculerPilierSatisfaction(avis: Avis[]): number | null {
  if (avis.length === 0) return null
  const poidsTotal = avis.reduce((acc, a) => acc + (a.auteurType === 'beneficiaire' ? 0.7 : 0.3), 0)
  const noteTotalePonderee = avis.reduce((acc, a) => acc + a.note * (a.auteurType === 'beneficiaire' ? 0.7 : 0.3), 0)
  return (noteTotalePonderee / poidsTotal / 5) * 100 // note sur 5 -> pourcentage
}

export type ScoreIpp = {
  score: number | null
  niveau: string | null
  piliers: { impactReel: number | null; qualiteSuivi: number; rigueurDocumentaire: number; satisfaction: number | null }
}

/** [PLACEHOLDER] seuil minimum d'échantillon avant publication publique — "à
 * définir avec la Fondatrice avant mise en production" (§8 du document). */
export const SEUIL_MINIMUM_ECHANTILLON = 3

export function calculerIpp(deltas: DeltaAffectation[], objectifs: Objectif[], entretiens: Entretien[], dossiers: Dossier[], avis: Avis[]): ScoreIpp {
  const impactReel = calculerPilierImpactReel(deltas, objectifs)
  const qualiteSuivi = calculerPilierQualiteSuivi(entretiens)
  const rigueurDocumentaire = calculerPilierRigueurDocumentaire(dossiers)
  const satisfaction = calculerPilierSatisfaction(avis)

  if (impactReel === null || satisfaction === null) {
    return { score: null, niveau: null, piliers: { impactReel, qualiteSuivi, rigueurDocumentaire, satisfaction } }
  }

  const score = impactReel * 0.45 + qualiteSuivi * 0.25 + rigueurDocumentaire * 0.15 + satisfaction * 0.15
  return { score: Math.round(score * 10) / 10, niveau: niveauDepuisScoreIpp(score), piliers: { impactReel, qualiteSuivi, rigueurDocumentaire, satisfaction } }
}

export function niveauDepuisScoreIpp(score: number): string {
  if (score >= 95) return 'Excellence pédagogique'
  if (score >= 90) return 'Très haute performance'
  if (score >= 80) return 'Très bonne performance'
  if (score >= 70) return 'Bonne performance'
  if (score >= 60) return 'Performance acceptable'
  if (score >= 50) return 'Performance fragile'
  return 'Performance insuffisante'
}
