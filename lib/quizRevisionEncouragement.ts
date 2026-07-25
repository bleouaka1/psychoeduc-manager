/** Encouragement et rappels — le "juste milieu" (handoff-quiz-revision-ia-3.md §9).
 * Ni gamification agressive (streaks, XP, classements) ni absence de motivation :
 * constat factuel de fréquence, progression appuyée sur les scores réels, rappels
 * de répétition espacée basés sur la dernière réponse par notion. Logique pure,
 * aucun appel IA (reste gratuit pour tous), testable en isolation. */

export type ReponseNotion = { notion: string; correcte: boolean; date: Date }

export type NotionProgression = {
  notion: string
  premiereDate: Date
  premiereReussite: boolean
  derniereDate: Date
  derniereReussite: boolean
  meriteRappel: boolean
}

/** Fréquence factuelle : nombre de jours DISTINCTS de révision sur les 7 derniers
 * jours — jamais un "streak" (aucune notion de série cassée/culpabilisante). */
export function calculerFrequenceHebdomadaire(datesCompletion: Date[]): number {
  const maintenant = Date.now()
  const septJours = 7 * 24 * 60 * 60 * 1000
  const joursDistincts = new Set(
    datesCompletion.filter((d) => maintenant - d.getTime() <= septJours).map((d) => d.toISOString().slice(0, 10)),
  )
  return joursDistincts.size
}

/**
 * Regroupe les réponses par notion (le terme/la réponse correcte testée, stable
 * même si le quiz est régénéré) et calcule, pour chacune, le premier et le dernier
 * résultat connu. `meriteRappel` = la dernière réponse connue sur cette notion était
 * incorrecte — c'est tout le signal de répétition espacée basique (intervalle fixe,
 * pas d'IA) : pas de calcul de date optimale de rappel, juste "cette notion mérite
 * un rappel" quand la dernière tentative était un échec.
 */
export function calculerProgressionParNotion(reponses: ReponseNotion[]): NotionProgression[] {
  const parNotion = new Map<string, ReponseNotion[]>()
  for (const r of reponses) {
    if (!parNotion.has(r.notion)) parNotion.set(r.notion, [])
    parNotion.get(r.notion)!.push(r)
  }

  const resultats: NotionProgression[] = []
  for (const [notion, occurrences] of parNotion) {
    const triees = [...occurrences].sort((a, b) => a.date.getTime() - b.date.getTime())
    const premiere = triees[0]
    const derniere = triees[triees.length - 1]
    resultats.push({
      notion,
      premiereDate: premiere.date,
      premiereReussite: premiere.correcte,
      derniereDate: derniere.date,
      derniereReussite: derniere.correcte,
      meriteRappel: !derniere.correcte,
    })
  }
  return resultats.sort((a, b) => b.derniereDate.getTime() - a.derniereDate.getTime())
}

/** Choisit la notion la plus parlante pour la visualisation avant/après (le plus grand
 * progrès réel, premier essai raté puis dernier réussi) — jamais inventée si aucune
 * notion ne qualifie. */
export function choisirNotionAvantApres(progressions: NotionProgression[]): NotionProgression | null {
  const candidates = progressions.filter((p) => p.premiereDate.getTime() !== p.derniereDate.getTime() && !p.premiereReussite && p.derniereReussite)
  return candidates[0] ?? null
}
