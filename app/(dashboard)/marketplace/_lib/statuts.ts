export const STATUT_STYLE: Record<string, 'ok' | 'warn' | 'down' | 'idle'> = {
  publiee: 'ok',
  visible_en_verification: 'warn',
  en_attente_validation: 'warn',
  refusee: 'down',
  masquee: 'down',
  retiree: 'idle',
}

export const STATUT_LABEL: Record<string, string> = {
  en_attente_validation: 'En attente de validation',
  visible_en_verification: 'Nouveau · en vérification',
  publiee: 'Publiée',
  masquee: 'Suspendue',
  refusee: 'Refusée',
  retiree: 'Supprimée',
}

export const VENDEUR_TYPE_LABEL: Record<string, string> = {
  solo: 'Indépendant',
  structure: 'Structure',
  employeur: 'Entreprise',
}
