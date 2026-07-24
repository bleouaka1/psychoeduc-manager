// Constantes et types partagés des fiches d'entretien (Général / Spécialisé).
// CLAUDE-CODE-Entretiens-Messagerie.md §2. Les 12 dimensions IGA réelles (Étape 9,
// table dimensions_iga) remplacent la liste à 8 dimensions du mockup, qui n'était
// qu'un exemple provisoire (§4.1) — la vraie liste existe déjà en base.

export const ETAPES_PARCOURS = ['Projet de vie', 'Former', 'Accompagner', 'Évaluer', 'Insérer', 'Réussir'] as const

export const TYPES_ENTRETIEN_GENERAL = ['Signalement', 'Suivi régulier', "Bilan d'étape"] as const
export type CategorieEntretienGeneral = (typeof TYPES_ENTRETIEN_GENERAL)[number]

export const SOURCES_SIGNALEMENT = [
  'Parent / Tuteur',
  'Formateur / Responsable',
  'Structure',
  'École',
  'ONG partenaire',
  'Auto-signalement',
  'Autre',
] as const

export const THEMATIQUES_PRESETS = [
  'Apprentissage & difficultés scolaires',
  'Langage & communication',
  'Situation financière / précarité',
  'Logement',
  'Santé physique',
  'Santé mentale & bien-être',
  'Famille & relations',
  'Emploi & orientation professionnelle',
  'Compétences numériques',
  'Démarches administratives / juridiques',
  'Mobilité',
  'Réseau social & communautaire',
  'Autre',
] as const

export type BlocThematique = {
  id: string
  thematique: string
  thematiqueAutre: string
  constat: string
  besoin: string
  action: string
}

export type DonneesEntretienGeneral = {
  categorie: CategorieEntretienGeneral
  etapeParcours: string
  signalement: {
    origine: string
    nomStructure: string
    origineAutre: string
    motif: string
  }
  dimensionsIds: string[]
  blocs: BlocThematique[]
  syntheseGenerale: string
  recommandations: string
  prochainRdv: string
}

export const nouveauBlocThematique = (): BlocThematique => ({
  id: crypto.randomUUID(),
  thematique: THEMATIQUES_PRESETS[0],
  thematiqueAutre: '',
  constat: '',
  besoin: '',
  action: '',
})

export const donneesEntretienGeneralParDefaut = (): DonneesEntretienGeneral => ({
  categorie: 'Suivi régulier',
  etapeParcours: ETAPES_PARCOURS[2],
  signalement: { origine: SOURCES_SIGNALEMENT[0], nomStructure: '', origineAutre: '', motif: '' },
  dimensionsIds: [],
  blocs: [nouveauBlocThematique()],
  syntheseGenerale: '',
  recommandations: '',
  prochainRdv: '',
})

export const ORIGINES_SPECIALISE = [
  'Enseignant / Formateur',
  'Parent / Tuteur',
  'Structure',
  'ONG partenaire',
  'Auto-signalement',
  'Autre',
] as const

export const COMPORTEMENTS_PRESETS = [
  'Agitation / difficulté à rester assis',
  'Manque de concentration',
  'Oublis fréquents de matériel',
  'Comportement impulsif',
  'Agression physique',
  'Agression verbale',
  'Retrait social / isolement',
  "Refus d'aller en formation",
  'Tristesse persistante',
  'Anxiété / signes physiques',
  'Parole hésitante ou faible',
  "Faible estime de soi",
  'Difficulté à exprimer ses émotions',
  'Absentéisme répété',
  'Victime de harcèlement',
  'Comportement de harcèlement envers autrui',
  'Tensions avec la famille',
  'Regard fuyant / attitude anxieuse',
] as const

export type DonneesEntretienSpecialise = {
  origine: string
  origineAutre: string
  motifDescription: string
  comportements: string[]
  verbatim: string
  analyse: string
  objectifs: string
  strategies: string
  suiviPrevu: string
  commentaires: string
}

export const donneesEntretienSpecialiseParDefaut = (): DonneesEntretienSpecialise => ({
  origine: ORIGINES_SPECIALISE[0],
  origineAutre: '',
  motifDescription: '',
  comportements: [],
  verbatim: '',
  analyse: '',
  objectifs: '',
  strategies: '',
  suiviPrevu: '',
  commentaires: '',
})

/** L'âge n'est jamais stocké — toujours calculé depuis date_naissance (règle absolue §0). */
export function calculerAge(dateNaissance: string | null): number | null {
  if (!dateNaissance) return null
  const naissance = new Date(dateNaissance)
  const aujourdhui = new Date()
  let age = aujourdhui.getFullYear() - naissance.getFullYear()
  const moisDiff = aujourdhui.getMonth() - naissance.getMonth()
  if (moisDiff < 0 || (moisDiff === 0 && aujourdhui.getDate() < naissance.getDate())) age--
  return age
}

export const SEXE_LABEL: Record<string, string> = { masculin: 'Masculin', feminin: 'Féminin', non_renseigne: 'Non renseigné' }

// §4.2 Compte Structure — champ Interlocuteur, colonne réelle entretiens.interlocuteur
// (pas dans `donnees jsonb`), donc géré à part des deux types Donnees* ci-dessus.
export const INTERLOCUTEURS = ['beneficiaire', 'parent_tuteur', 'conjoint'] as const
export type Interlocuteur = (typeof INTERLOCUTEURS)[number]
export const INTERLOCUTEUR_LABEL: Record<Interlocuteur, string> = {
  beneficiaire: 'Bénéficiaire',
  parent_tuteur: 'Parent-Tuteur',
  conjoint: 'Bénéficiaire + Parent-Tuteur (conjoint)',
}

/** Signatures partagées Solo/Structure — chaque contexte fournit sa propre implémentation
 * (organisation résolue différemment), les composants FicheEntretien* restent identiques. */
export type ActionEnregistrerEntretien = (
  entretienId: string,
  beneficiaireId: string,
  donnees: Record<string, unknown>,
  statut: 'brouillon' | 'valide',
  interlocuteur: Interlocuteur,
) => Promise<{ error: string | null }>

export type ActionMettreAJourScolarisation = (beneficiaireId: string, scolarise: boolean, classe: string) => Promise<{ error: string | null }>
