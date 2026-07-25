/** Assistant vocal global — logique hybride (handoff-vocal-layout-themes.md §1.5).
 * Étape 1, gratuite : reconnaissance de mots-clés simples, aucun appel IA. Logique
 * pure, testable en isolation (même principe que le reste du projet). L'étape 2
 * (repli Haiku pour une phrase ambiguë) vit dans l'action serveur, pas ici — cette
 * fonction ne fait QUE le matching gratuit, jamais un appel réseau. */

export type DestinationVocale = { suffixe: string; libelle: string }

const ROUTES_MOTS_CLES: { motsCles: string[]; suffixe: string; libelle: string }[] = [
  { motsCles: ['réviser', 'reviser', 'quiz', 'révision', 'revision'], suffixe: 'revisions', libelle: 'Révisions & Quiz' },
  { motsCles: ['compétence', 'competence', 'icc'], suffixe: '#profil-professionnel', libelle: 'Mes compétences' },
  { motsCles: ['autonomie', 'iga', 'boussole'], suffixe: '#boussole', libelle: 'Mon IGA' },
  { motsCles: ['objectif'], suffixe: 'projets-vie', libelle: 'Mes objectifs' },
  { motsCles: ['tuteur', 'entretien', 'discuter'], suffixe: 'tuteurs', libelle: 'Espace Tuteurs' },
  { motsCles: ['marketplace', 'apprentissage', 'formation'], suffixe: 'marketplace', libelle: "Espace d'apprentissage" },
  { motsCles: ['emploi', 'travail', 'professionnel', 'session pro'], suffixe: 'insertion', libelle: 'Session professionnelle' },
  { motsCles: ['cv', 'curriculum'], suffixe: 'cv', libelle: 'Mon CV' },
  { motsCles: ['crédit', 'credit', 'abonnement'], suffixe: 'abonnement', libelle: 'Mon abonnement' },
  { motsCles: ['paramètre', 'parametre', 'thème', 'theme', 'accessibilité'], suffixe: 'parametres', libelle: 'Paramètres' },
]

/**
 * Cherche un mot-clé connu dans la phrase transcrite — retourne la première
 * correspondance (ordre de priorité = ordre de la liste), ou `null` si aucun mot-clé
 * ne matche (phrase ambiguë, à traiter par un repli IA plus tard, jamais deviné ici).
 */
export function interpreterCommandeVocale(texte: string): DestinationVocale | null {
  const normalise = texte.toLowerCase()
  for (const route of ROUTES_MOTS_CLES) {
    if (route.motsCles.some((mot) => normalise.includes(mot))) {
      return { suffixe: route.suffixe, libelle: route.libelle }
    }
  }
  return null
}
