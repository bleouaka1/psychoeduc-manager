/** Registre des couleurs du carrousel "Reprendre mon activité" (dashboard bénéficiaire
 * v3) — retour utilisateur explicite : chaque type d'activité (présent ou futur) doit
 * avoir sa PROPRE couleur distincte, jamais une couleur réutilisée ou oubliée par
 * défaut. Chacun des 10 thèmes (`app/globals.css`) définit 6 variables CSS
 * `--accent-*` distinctes : 4 déjà assignées ci-dessous, 2 réservées pour de futurs
 * types d'activité. Un nouveau type d'activité ajouté à `activitesRecentes` doit
 * appeler `couleurActivite(cle)` plutôt que d'écrire directement `var(--accent-x)` —
 * s'il n'est pas encore dans le registre, il reçoit automatiquement une des couleurs
 * réservées (choisie de façon stable à partir de son identifiant), jamais un défaut
 * partagé avec une activité existante. */

const REGISTRE_COULEURS_ACTIVITES: Record<string, string> = {
  apprentissage: 'var(--accent-apprentissage)',
  tuteur: 'var(--accent-tuteur)',
  revisions: 'var(--accent-revisions)',
  session_pro: 'var(--accent-pro)',
}

const COULEURS_RESERVEES_FUTURES = ['var(--accent-module-5)', 'var(--accent-module-6)'] as const

export function couleurActivite(cle: string): string {
  const couleurConnue = REGISTRE_COULEURS_ACTIVITES[cle]
  if (couleurConnue) return couleurConnue

  const somme = [...cle].reduce((acc, caractere) => acc + caractere.charCodeAt(0), 0)
  return COULEURS_RESERVEES_FUTURES[somme % COULEURS_RESERVEES_FUTURES.length]
}
