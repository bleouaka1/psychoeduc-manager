import { calculerAgeAns } from './iga'

/** Cercles d'apprentissage — logique métier pure (CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md §5).
 * Modération obligatoire si mineur présent (§5.2) : vérifiée ici en TypeScript
 * plutôt qu'un trigger SQL, même principe que le reste du projet pour la logique métier. */

export const SEUIL_MAJORITE_ANS = 18

export function estMineur(dateNaissance: string | Date | null): boolean {
  const age = calculerAgeAns(dateNaissance)
  return age != null && age < SEUIL_MAJORITE_ANS
}

/** Un cercle "réservé aux adultes" ne peut jamais accueillir un mineur — vérifié à
 * l'invitation, pas seulement affiché. */
export function peutRejoindreCercle(reserveAdultes: boolean, dateNaissanceBeneficiaire: string | Date | null): boolean {
  if (!reserveAdultes) return true
  return !estMineur(dateNaissanceBeneficiaire)
}

/** Seuil de décrochage silencieux (§5.3 : exemple "12 jours" du document) —
 * [PLACEHOLDER], à ajuster avec des données réelles. */
export const SEUIL_JOURS_DECROCHAGE = 12

export function estEnDecrochage(dateDerniereActivite: string | Date | null): boolean {
  if (!dateDerniereActivite) return false
  const derniere = typeof dateDerniereActivite === 'string' ? new Date(dateDerniereActivite) : dateDerniereActivite
  const jours = (Date.now() - derniere.getTime()) / (1000 * 60 * 60 * 24)
  return jours >= SEUIL_JOURS_DECROCHAGE
}

/** Message-modèle en 3 parties (§5.4 du document) — jamais un script imposé, une
 * suggestion. Texte statique, aucune génération IA. */
export function genererAlerteDecrochage(prenom: string, joursSansActivite: number): string {
  return (
    `${prenom} n'a plus participé au cercle depuis ${joursSansActivite} jour(s), alors qu'il/elle était actif·ve auparavant. ` +
    `Le décrochage silencieux est souvent le signe le plus précoce d'un désengagement. ` +
    `Un message privé simple ("Tout va bien ?") suffit souvent à rouvrir le dialogue.`
  )
}
