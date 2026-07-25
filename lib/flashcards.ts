/** Flashcards (dashboard bénéficiaire v3, Lot I) — logique pure, aucune dépendance
 * DB/IA ici. Palier base : réutilise le pipeline NLP déjà en place pour le quiz
 * (`decouperEnPhrases`/`detecterDefinitions`, lib/quizRevision.ts), jamais dupliqué.
 * Palier avancé (mnémotechnique IA) : construction du prompt seulement, l'appel
 * Haiku vit dans l'action serveur (même découplage que le reste du projet). */

import { decouperEnPhrases, detecterDefinitions } from './quizRevision'

export type Flashcard = { recto: string; verso: string }

/** Génère des flashcards recto/verso à partir des définitions détectées dans le
 * texte source — pas de minimum imposé (contrairement au quiz), une flashcard par
 * définition distincte détectée. Peut être vide si le texte n'a aucune définition
 * reconnaissable ; c'est un résultat honnête, pas une erreur. */
export function genererFlashcardsBase(texteSource: string): Flashcard[] {
  const phrases = decouperEnPhrases(texteSource)
  const definitions = detecterDefinitions(phrases)

  const vues = new Set<string>()
  const flashcards: Flashcard[] = []
  for (const d of definitions) {
    const cle = d.sujet.toLowerCase()
    if (vues.has(cle)) continue
    vues.add(cle)
    flashcards.push({ recto: d.sujet, verso: d.definition })
  }
  return flashcards
}

/** Prompt système pour la couche mnémotechnique (§12.3, palier avancé) — une aide
 * concise par carte, jamais un paragraphe, ancrée dans le contenu réel de la carte. */
export function construirePromptMnemotechnique(cartes: Flashcard[]): string {
  const liste = cartes.map((c, i) => `${i + 1}. ${c.recto} → ${c.verso}`).join('\n')
  return `Tu aides à mémoriser des notions pour un public en insertion socio-professionnelle.
Pour chacune des cartes suivantes (recto → verso), propose une aide mnémotechnique courte (une phrase, un acronyme, ou une association d'image) — jamais un paragraphe, jamais superflu.

Cartes :
${liste}

Format de sortie JSON strict, sans texte hors JSON :
{"aides": [{"recto": "string (doit correspondre exactement au recto fourni)", "mnemotechnique": "string (courte)"}]}`
}

export function parserAidesMnemotechniques(brut: unknown): Map<string, string> {
  const resultat = new Map<string, string>()
  if (!brut || typeof brut !== 'object') return resultat
  const aides = (brut as any).aides
  if (!Array.isArray(aides)) return resultat
  for (const a of aides) {
    if (typeof a?.recto === 'string' && typeof a?.mnemotechnique === 'string') resultat.set(a.recto, a.mnemotechnique)
  }
  return resultat
}
