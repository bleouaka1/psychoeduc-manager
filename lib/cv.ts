/** Génération de CV par IA — logique pure (construction du prompt, aucun appel réseau
 * ni accès base ici), même principe que lib/quizRevision.ts. Réf : handoff-icc-cv-
 * navigation.md §2. Le flux bénéficiaire est le seul câblé pour l'instant (§4) ; le
 * schéma et cette logique restent volontairement génériques pour que Solo/Structure/
 * Employeur puissent réutiliser la même construction de prompt plus tard (§2.2). */

export type DonneesSourceCv = {
  prenoms: string
  nom: string
  organisationNom: string | null
  scoreIga: number | null
  niveauIga: string | null
  icc: { savoirs: number | null; savoirFaire: number | null; savoirEtre: number | null }
  formations: string[]
  projetsVie: string[]
}

export type ContenuCv = {
  titreDocument: string
  resume: string
  competencesCles: string[]
  experiencesFormations: { titre: string; description: string }[]
  qualitesSavoirEtre: string[]
  objectifProfessionnel: string
}

/**
 * Adapte automatiquement le format selon l'âge (§2.3) : un CV de recherche d'emploi
 * classique pour un majeur, un "profil de stage / découverte professionnelle" pour un
 * mineur — jamais une simulation de candidature à un emploi rémunéré pour ce dernier.
 * L'appelant détecte le mineur via lib/cerclesApprentissage.ts::estMineur, jamais
 * dupliqué ici (logique déjà centralisée dans ce projet).
 */
export function construirePromptCv(donnees: DonneesSourceCv, estMineur: boolean): string {
  const contexteAge = estMineur
    ? `Le bénéficiaire est MINEUR. Ne génère jamais un CV de recherche d'emploi classique : produis un "profil de stage / découverte professionnelle", centré sur les compétences observées, le savoir-être et les centres d'intérêt professionnels — jamais une simulation de candidature à un emploi rémunéré.`
    : `Le bénéficiaire est majeur : produis un CV de recherche d'emploi classique et professionnel.`

  return `Tu es un rédacteur de CV pour un public en insertion socio-professionnelle.
${contexteAge}

Génère le document au format JSON strict, sans texte hors JSON, à partir des données suivantes :
- Nom : ${donnees.prenoms} ${donnees.nom}
- Structure d'accompagnement : ${donnees.organisationNom ?? 'non renseignée'}
- Score IGA (autonomie générale, sur 100) : ${donnees.scoreIga ?? 'non évalué'} (${donnees.niveauIga ?? 'non renseigné'})
- Indice de Compétences — Savoirs : ${donnees.icc.savoirs ?? 'non évalué'}, Savoir-faire : ${donnees.icc.savoirFaire ?? 'non évalué'}, Savoir-être : ${donnees.icc.savoirEtre ?? 'non évalué'}
- Formations suivies : ${donnees.formations.length > 0 ? donnees.formations.join(', ') : 'aucune renseignée'}
- Objectifs de vie exprimés : ${donnees.projetsVie.length > 0 ? donnees.projetsVie.join(', ') : 'aucun renseigné'}

Ton sobre et honnête, jamais exagéré ni inventé au-delà des données fournies.

Format de sortie JSON :
{
  "titre_document": "string (\\"Curriculum Vitae\\" ou \\"Profil de stage / découverte professionnelle\\")",
  "resume": "string (2-3 phrases)",
  "competences_cles": ["...", "..."],
  "experiences_formations": [{"titre": "string", "description": "string"}],
  "qualites_savoir_etre": ["...", "..."],
  "objectif_professionnel": "string"
}`
}

export function parserContenuCv(brut: unknown): ContenuCv | null {
  if (!brut || typeof brut !== 'object') return null
  const b = brut as any
  if (typeof b.titre_document !== 'string' || typeof b.resume !== 'string') return null
  return {
    titreDocument: b.titre_document,
    resume: b.resume,
    competencesCles: Array.isArray(b.competences_cles) ? b.competences_cles : [],
    experiencesFormations: Array.isArray(b.experiences_formations) ? b.experiences_formations : [],
    qualitesSavoirEtre: Array.isArray(b.qualites_savoir_etre) ? b.qualites_savoir_etre : [],
    objectifProfessionnel: typeof b.objectif_professionnel === 'string' ? b.objectif_professionnel : '',
  }
}
