import { ShieldCheck } from 'lucide-react'

/**
 * "NOUVEAU · EN VÉRIFICATION" — offre visible immédiatement (publication
 * automatique) mais pas encore validée par le Fondateur. Ambré, cohérent avec
 * la palette existante (accent-gold) : c'est une information de transparence,
 * pas une erreur — jamais de rouge alarmant.
 */
export function BadgeEnVerification() {
  return (
    <span className="inline-flex items-center gap-1 bg-accent-gold-dim/40 text-accent-gold text-[9.5px] font-bold px-2 py-0.5 rounded-full tracking-wide">
      <ShieldCheck size={10} /> NOUVEAU · EN VÉRIFICATION
    </span>
  )
}
