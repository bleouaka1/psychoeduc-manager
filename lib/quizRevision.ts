/** Module "Quiz de révision" (handoff-quiz-revision-ia-3.md) — logique métier pure,
 * en TypeScript standard, aucune dépendance DB ni IA ici (testable en isolation,
 * même principe que lib/iga.ts). Couvre le moteur de génération GRATUIT (§5.1) et
 * l'écran de préférence (§3) — jamais d'appel réseau dans ce fichier. */

export type QuestionQuiz = {
  id: string
  type: 'qcm' | 'ouverte'
  categorie: string
  enonce: string
  options?: string[]
  reponseCorrecte: string
  explication: string
}

export type ContenuQuiz = { questions: QuestionQuiz[]; minimumAtteint?: boolean }

// ---------------------------------------------------------------------------
// §3 — Écran de préférence : mapping statique, aucune génération dynamique.
// ---------------------------------------------------------------------------
export type PreferenceObjectif = 'rapide' | 'excellence'

export const RECOMMANDATION_OBJECTIF: Record<PreferenceObjectif, { message: string; niveauConseille: 'standard' | 'excellence' }> = {
  rapide: {
    message: 'Les QCM sont parfaits pour réviser efficacement, sans y passer trop de temps.',
    niveauConseille: 'standard',
  },
  excellence: {
    message:
      'Les questions ouvertes demandent plus de réflexion — c\'est ce qui prépare le mieux à un vrai entretien ou une évaluation. Ce format fait partie du mode approfondi.',
    niveauConseille: 'excellence',
  },
}

// ---------------------------------------------------------------------------
// §5.1 — Moteur de génération gratuit, sans IA (règles/NLP classique).
// Cible 50 questions minimum (§5.1, v3) : varie les angles (texte à trous,
// question inversée définition→terme, vrai/faux) plutôt que de répéter la même
// question à l'identique — un même fait source peut donner 3-4 questions distinctes.
// ---------------------------------------------------------------------------

const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'est', 'sont', 'a', 'au', 'aux', 'ce', 'ces',
  'que', 'qui', 'dans', 'pour', 'par', 'sur', 'avec', 'son', 'sa', 'ses', 'se', 'ne', 'pas', 'plus', 'il', 'elle',
  'on', 'nous', 'vous', 'ils', 'elles', 'être', 'avoir', 'en', 'à', 'd', 'l', 'c', 'qu', 's', 'n',
])

export function decouperEnPhrases(texte: string): string[] {
  return texte
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 20)
}

function extraireMotsCles(texte: string, limite = 40): string[] {
  const mots = (texte.toLowerCase().match(/[a-zàâäéèêëïîôöùûüç-]{4,}/g) ?? []).filter((m) => !MOTS_VIDES.has(m))
  const frequences = new Map<string, number>()
  for (const mot of mots) frequences.set(mot, (frequences.get(mot) ?? 0) + 1)
  return Array.from(frequences.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([mot]) => mot)
}

// Motifs de définition : "X est/désigne/correspond à ..." — capture le sujet et la définition.
const MOTIFS_DEFINITION = [
  /^(.{2,40}?)\s+(?:est|désigne|correspond à|signifie)\s+(.{10,200})$/i,
  /^(.{2,40}?)\s*:\s*(.{10,200})$/,
]

export type Definition = { sujet: string; definition: string; phrase: string }

export function detecterDefinitions(phrases: string[]): Definition[] {
  const definitions: Definition[] = []
  for (const phrase of phrases) {
    for (const motif of MOTIFS_DEFINITION) {
      const correspondance = phrase.match(motif)
      if (correspondance) {
        definitions.push({ sujet: correspondance[1].trim(), definition: correspondance[2].trim(), phrase })
        break
      }
    }
  }
  return definitions
}

function tirerDistracteurs(motCorrect: string, banque: string[], nombre = 3): string[] {
  const candidats = banque.filter((m) => m.toLowerCase() !== motCorrect.toLowerCase())
  const distracteurs: string[] = []
  const copie = [...candidats]
  while (distracteurs.length < nombre && copie.length > 0) {
    const index = Math.floor(Math.random() * copie.length)
    distracteurs.push(copie.splice(index, 1)[0])
  }
  // Banque générique de secours si le document ne fournit pas assez de mots-clés distincts.
  const secours = ['contexte', 'processus', 'méthode', 'ressource', 'objectif', 'structure']
  while (distracteurs.length < nombre) {
    const mot = secours[distracteurs.length % secours.length]
    if (!distracteurs.includes(mot) && mot !== motCorrect) distracteurs.push(mot)
  }
  return distracteurs
}

function melanger<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

/**
 * Génère un quiz "texte à trous" à partir d'un texte source, sans aucun appel IA.
 * Qualité assumée comme inférieure au palier payant (cf. §5.1 du document) — jamais
 * présenté comme équivalent, message d'avertissement géré côté UI, pas ici.
 *
 * Cible `nbQuestionsCible` (50 par défaut, §5.1 v3) : si le document source ne permet
 * pas d'atteindre ce minimum même en variant les angles, retourne le maximum possible
 * et `minimumAtteint: false` — jamais de question dupliquée à l'identique pour
 * combler artificiellement le compte.
 */
export function genererQuizGratuit(texteSource: string, nbQuestionsCible = 50): ContenuQuiz {
  const phrases = decouperEnPhrases(texteSource)
  const motsCles = extraireMotsCles(texteSource)
  const definitions = detecterDefinitions(phrases)

  const questions: QuestionQuiz[] = []
  const enoncesUtilises = new Set<string>()
  let compteur = 1

  function ajouter(q: Omit<QuestionQuiz, 'id'>) {
    if (enoncesUtilises.has(q.enonce)) return
    enoncesUtilises.add(q.enonce)
    questions.push({ id: `q${compteur++}`, ...q })
  }

  // Angle 1 — texte à trous sur le terme défini.
  for (const def of definitions) {
    const options = melanger([def.sujet, ...tirerDistracteurs(def.sujet, motsCles, 3)])
    ajouter({
      type: 'qcm',
      categorie: 'Définition',
      enonce: `Complète : "___ ${def.definition}"`,
      options,
      reponseCorrecte: def.sujet,
      explication: def.phrase,
    })
  }

  // Angle 2 — question inversée : terme → définition (au lieu de définition → terme).
  for (const def of definitions) {
    const autresDefinitions = definitions.filter((d) => d.sujet !== def.sujet).map((d) => d.definition)
    const options = melanger([def.definition, ...tirerDistracteurs(def.definition, autresDefinitions.length >= 3 ? autresDefinitions : [...autresDefinitions, ...motsCles], 3)])
    ajouter({
      type: 'qcm',
      categorie: 'Définition',
      enonce: `Que signifie "${def.sujet}" ?`,
      options,
      reponseCorrecte: def.definition,
      explication: def.phrase,
    })
  }

  // Angle 3 — vrai/faux sur l'énoncé d'origine (vrai) et une version altérée (faux, terme substitué).
  for (const def of definitions) {
    ajouter({
      type: 'qcm',
      categorie: 'Vrai ou faux',
      enonce: `Vrai ou faux : "${def.phrase}"`,
      options: ['Vrai', 'Faux'],
      reponseCorrecte: 'Vrai',
      explication: def.phrase,
    })
    const distracteur = tirerDistracteurs(def.sujet, motsCles, 1)[0]
    if (distracteur) {
      const phraseAlteree = def.phrase.replace(new RegExp(def.sujet, 'i'), distracteur)
      if (phraseAlteree !== def.phrase) {
        ajouter({
          type: 'qcm',
          categorie: 'Vrai ou faux',
          enonce: `Vrai ou faux : "${phraseAlteree}"`,
          options: ['Vrai', 'Faux'],
          reponseCorrecte: 'Faux',
          explication: def.phrase,
        })
      }
    }
  }

  // Angle 4 — texte à trous sur chaque mot-clé, dans CHAQUE phrase où il apparaît
  // (pas seulement la première) : une même notion revient souvent dans un support
  // de formation, chaque occurrence est une question distincte et légitime.
  for (const motCle of motsCles) {
    const phrasesAvecMotCle = phrases.filter((p) => p.toLowerCase().includes(motCle))
    for (const phraseSource of phrasesAvecMotCle) {
      const enonce = phraseSource.replace(new RegExp(motCle, 'i'), '___')
      if (enonce === phraseSource) continue
      const options = melanger([motCle, ...tirerDistracteurs(motCle, motsCles, 3)])
      ajouter({
        type: 'qcm',
        categorie: 'Mot-clé',
        enonce,
        options,
        reponseCorrecte: motCle,
        explication: phraseSource,
      })
    }
  }

  return { questions: questions.slice(0, nbQuestionsCible), minimumAtteint: questions.length >= nbQuestionsCible }
}

// ---------------------------------------------------------------------------
// §6 — Chronométrage (constantes, la logique d'affichage vit dans le composant client)
// ---------------------------------------------------------------------------
export const CHRONO_PAR_QUESTION_SEC = 40
export const CHRONO_GLOBAL_SEC = 600
