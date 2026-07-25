/** Module "Quiz de révision" (handoff-quiz-revision-ia-2.md) — logique métier pure,
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

export type ContenuQuiz = { questions: QuestionQuiz[] }

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
// ---------------------------------------------------------------------------

const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'est', 'sont', 'a', 'au', 'aux', 'ce', 'ces',
  'que', 'qui', 'dans', 'pour', 'par', 'sur', 'avec', 'son', 'sa', 'ses', 'se', 'ne', 'pas', 'plus', 'il', 'elle',
  'on', 'nous', 'vous', 'ils', 'elles', 'être', 'avoir', 'en', 'à', 'd', 'l', 'c', 'qu', 's', 'n',
])

function decouperEnPhrases(texte: string): string[] {
  return texte
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 20)
}

function extraireMotsCles(texte: string, limite = 15): string[] {
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

type Definition = { sujet: string; definition: string; phrase: string }

function detecterDefinitions(phrases: string[]): Definition[] {
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
  const candidats = banque.filter((m) => m !== motCorrect)
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

/**
 * Génère un quiz "texte à trous" à partir d'un texte source, sans aucun appel IA.
 * Qualité assumée comme inférieure au palier payant (cf. §5.1 du document) — jamais
 * présenté comme équivalent, message d'avertissement géré côté UI, pas ici.
 */
export function genererQuizGratuit(texteSource: string, nbQuestions = 8): ContenuQuiz {
  const phrases = decouperEnPhrases(texteSource)
  const motsCles = extraireMotsCles(texteSource)
  const definitions = detecterDefinitions(phrases)

  const questions: QuestionQuiz[] = []
  let compteur = 1

  // Priorité aux phrases de définition explicite (meilleure qualité de question).
  for (const def of definitions) {
    if (questions.length >= nbQuestions) break
    const options = [def.sujet, ...tirerDistracteurs(def.sujet, motsCles, 3)].sort(() => Math.random() - 0.5)
    questions.push({
      id: `q${compteur++}`,
      type: 'qcm',
      categorie: 'Définition',
      enonce: `Complète : "___ ${def.definition}"`,
      options,
      reponseCorrecte: def.sujet,
      explication: def.phrase,
    })
  }

  // Complète avec des questions "texte à trous" sur les mots-clés dans leur phrase d'origine.
  for (const motCle of motsCles) {
    if (questions.length >= nbQuestions) break
    const phraseSource = phrases.find((p) => p.toLowerCase().includes(motCle))
    if (!phraseSource) continue
    const enonce = phraseSource.replace(new RegExp(motCle, 'i'), '___')
    if (enonce === phraseSource) continue
    const options = [motCle, ...tirerDistracteurs(motCle, motsCles, 3)].sort(() => Math.random() - 0.5)
    questions.push({
      id: `q${compteur++}`,
      type: 'qcm',
      categorie: 'Mot-clé',
      enonce,
      options,
      reponseCorrecte: motCle,
      explication: phraseSource,
    })
  }

  return { questions }
}

// ---------------------------------------------------------------------------
// §6 — Chronométrage (constantes, la logique d'affichage vit dans le composant client)
// ---------------------------------------------------------------------------
export const CHRONO_PAR_QUESTION_SEC = 40
export const CHRONO_GLOBAL_SEC = 600
