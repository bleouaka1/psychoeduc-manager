/** Espace Tuteurs IA (+ Simulation d'entretien, mode spécialisé) — logique pure de
 * construction du prompt système, aucun appel réseau/DB ici (même principe que
 * lib/quizRevision.ts, lib/cv.ts). Réf : prompt du 2026-07-25 §7-10, PLAN_DASHBOARD_
 * BENEFICIAIRE_V2.md Lot D. Un seul moteur de conversation pour tutorat ET simulation
 * d'entretien — `objectif` ne change que la persona utilisée, jamais le code. */

export type ObjectifTuteur = 'tutorat' | 'entretien'

export type PersonaTuteur = {
  id: string
  nom: string
  domaine: string
  description: string | null
  objectif: ObjectifTuteur
  promptSystemeBase: string
  coutCredits: number
}

/** Clause de sécurité systématiquement injectée (§9 du prompt) — jamais une simple
 * note documentée en commentaire, un texte réellement présent dans CHAQUE prompt
 * envoyé à Haiku, quelle que soit la persona. Vérifiable par test (voir
 * verifierGardeFouPersonas ci-dessous), pas seulement documentée. */
const CLAUSE_SECURITE_PERSONAS = `Consigne de sécurité impérative : si cette persona évoque une personne réelle et identifiable, précise explicitement à l'apprenant qu'il s'agit d'une simulation inspirée de ses idées, œuvres ou connaissances publiques — jamais une conversation réellement tenue avec cette personne. N'invente jamais de citation et ne la présente jamais comme authentique. Ces règles s'appliquent quel que soit le montant payé par l'utilisateur pour cette session.`

/**
 * Construit le prompt système complet pour une session — base de la persona (définie
 * par le Fondateur) + contexte du document source (absent pour un entretien) + clause
 * de sécurité toujours présente en fin de prompt.
 */
export function construirePromptSystemeTuteur(persona: PersonaTuteur, contenuDocument: string | null): string {
  const contexteDocument = contenuDocument
    ? `\n\nContenu du document sur lequel s'appuie cette session (reste ancré dedans, n'invente pas au-delà) :\n${contenuDocument.slice(0, 8000)}`
    : ''

  return `${persona.promptSystemeBase}${contexteDocument}\n\n${CLAUSE_SECURITE_PERSONAS}`
}

/** Vérifie que la clause de sécurité est bien présente dans un prompt construit —
 * utilisé en test, pas en production (le prompt la contient toujours par construction,
 * ce test protège contre une régression future de construirePromptSystemeTuteur). */
export function verifierGardeFouPersonas(promptConstruit: string): boolean {
  return promptConstruit.includes(CLAUSE_SECURITE_PERSONAS)
}

export type MessageTuteur = { role: 'user' | 'assistant'; contenu: string }

/** Formate l'historique de conversation pour l'API Claude — simple projection de
 * champ, isolée ici pour que actions.ts n'ait pas à connaître le format exact de
 * l'API (même découplage que le reste du projet). */
export function construireMessagesHaiku(historique: MessageTuteur[]): { role: 'user' | 'assistant'; content: string }[] {
  return historique.map((m) => ({ role: m.role, content: m.contenu }))
}
