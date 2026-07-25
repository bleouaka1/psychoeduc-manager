/**
 * Indicatif de tarification (retour utilisateur explicite : ne jamais retirer ces
 * indicatifs — le bénéficiaire doit toujours savoir avant de cliquer si un service
 * est inclus dans l'abonnement de base, payé en crédits, ou à prix fixe).
 */
type TypeTarif = 'base' | 'credits' | 'fixe'

export function BadgeTarif({ type, texte }: { type: TypeTarif; texte: string }) {
  const styles: Record<TypeTarif, string> = {
    base: 'bg-status-ok-bg text-status-ok border-status-ok/35',
    credits: 'bg-accent-gold/12 text-accent-gold border-accent-gold-dim/40',
    fixe: 'bg-[#4f8ff0]/12 text-[#8fb4f5] border-[#4f8ff0]/35',
  }

  return <span className={`font-data text-[9.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${styles[type]}`}>{texte}</span>
}
