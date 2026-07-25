/** Génération de CV par IA — logique pure (construction du prompt, aucun appel réseau
 * ni accès base ici), même principe que lib/quizRevision.ts. Réf : handoff-icc-cv-
 * navigation-1.md §2 (révision) : un générateur de CV **standard et autonome**, comme
 * n'importe quelle plateforme — le formulaire édité par l'utilisateur est la seule
 * source de vérité envoyée à Haiku, jamais l'ICC/IGA directement (écart documenté vs.
 * la v1 de ce module, cf. PLAN_DASHBOARD_BENEFICIAIRE_V3.md, écart 4). Le profil
 * ICC/IGA ne sert plus qu'à PRÉ-REMPLIR le formulaire, uniquement pour les
 * bénéficiaires, uniquement sur action explicite — jamais une dépendance technique. */

export type ExperienceCv = { titre: string; structure: string; periode: string; description: string }
export type FormationCv = { titre: string; etablissement: string; periode: string }

export type FormulaireCv = {
  prenoms: string
  nom: string
  email: string
  telephone: string
  ville: string
  experiences: ExperienceCv[]
  formations: FormationCv[]
  competences: string[]
  langues: string[]
  centresInteret: string[]
}

export function formulaireCvVide(prenoms: string, nom: string): FormulaireCv {
  return { prenoms, nom, email: '', telephone: '', ville: '', experiences: [], formations: [], competences: [], langues: [], centresInteret: [] }
}

/**
 * Fusionne un pré-remplissage dans le formulaire déjà en cours d'édition — ne
 * remplace jamais wholesale (bug réel trouvé en testant : un remount sur l'état
 * effaçait la saisie manuelle déjà commencée au moment du clic). Les champs texte
 * ne sont complétés que s'ils sont encore vides ; les listes sont fusionnées sans
 * doublon plutôt que remplacées.
 */
export function fusionnerFormulaireCv(actuel: FormulaireCv, prerempli: FormulaireCv): FormulaireCv {
  const fusionnerListe = <T,>(a: T[], b: T[], cle: (v: T) => string): T[] => {
    const clesExistantes = new Set(a.map(cle))
    return [...a, ...b.filter((v) => !clesExistantes.has(cle(v)))]
  }

  return {
    prenoms: actuel.prenoms || prerempli.prenoms,
    nom: actuel.nom || prerempli.nom,
    email: actuel.email || prerempli.email,
    telephone: actuel.telephone || prerempli.telephone,
    ville: actuel.ville || prerempli.ville,
    experiences: fusionnerListe(actuel.experiences, prerempli.experiences, (e) => `${e.titre}|${e.structure}`),
    formations: fusionnerListe(actuel.formations, prerempli.formations, (f) => `${f.titre}|${f.etablissement}`),
    competences: fusionnerListe(actuel.competences, prerempli.competences, (c) => c),
    langues: fusionnerListe(actuel.langues, prerempli.langues, (l) => l),
    centresInteret: fusionnerListe(actuel.centresInteret, prerempli.centresInteret, (c) => c),
  }
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
 * L'appelant détecte le mineur via lib/cerclesApprentissage.ts::estMineur (bénéficiaires
 * uniquement — les autres types de compte n'ont pas de date de naissance à ce niveau).
 */
export function construirePromptCv(formulaire: FormulaireCv, estMineur: boolean): string {
  const contexteAge = estMineur
    ? `Le titulaire est MINEUR. Ne génère jamais un CV de recherche d'emploi classique : produis un "profil de stage / découverte professionnelle", centré sur les compétences observées, le savoir-être et les centres d'intérêt professionnels — jamais une simulation de candidature à un emploi rémunéré.`
    : `Produis un CV de recherche d'emploi classique et professionnel.`

  const experiences = formulaire.experiences.length
    ? formulaire.experiences.map((e) => `- ${e.titre} — ${e.structure} (${e.periode}) : ${e.description}`).join('\n')
    : 'aucune renseignée'
  const formations = formulaire.formations.length ? formulaire.formations.map((f) => `- ${f.titre} — ${f.etablissement} (${f.periode})`).join('\n') : 'aucune renseignée'

  return `Tu es un rédacteur de CV professionnel. Mets en forme et reformule le contenu saisi par l'utilisateur de façon professionnelle et valorisante — n'invente jamais une information absente du formulaire.
${contexteAge}

Génère le document au format JSON strict, sans texte hors JSON, à partir des données suivantes :
- Nom : ${formulaire.prenoms} ${formulaire.nom}
- Ville : ${formulaire.ville || 'non renseignée'}
- Expériences :
${experiences}
- Formations :
${formations}
- Compétences déclarées : ${formulaire.competences.length ? formulaire.competences.join(', ') : 'aucune renseignée'}
- Langues : ${formulaire.langues.length ? formulaire.langues.join(', ') : 'aucune renseignée'}
- Centres d'intérêt : ${formulaire.centresInteret.length ? formulaire.centresInteret.join(', ') : 'aucun renseigné'}

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
