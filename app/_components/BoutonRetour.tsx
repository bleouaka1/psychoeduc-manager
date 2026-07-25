'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/** Bouton retour (handoff-icc-cv-navigation.md §3) : revient à l'écran précédent dans
 * la pile de navigation, jamais systématiquement à l'accueil. Masqué sur l'écran
 * d'accueil de chaque dashboard, affiché sur tout écran secondaire. Rendu une seule fois
 * dans chaque layout partagé plutôt que dupliqué page par page. Composant partagé entre
 * /mon-espace, /solo et le Cockpit Fondateur — chacun avec sa propre notion d'accueil :
 * - /mon-espace/[id] est structurellement imbriqué (accueil à profondeur 2) → profondeurAccueil
 * - /solo et le Cockpit Fondateur sont plats (chaque écran top-level est déjà un écran
 *   propre, pas un sous-écran de l'accueil) → un chemin d'accueil exact via masquerSur */
export function BoutonRetour({
  profondeurAccueil = 0,
  masquerSur = [],
}: {
  profondeurAccueil?: number
  masquerSur?: string[]
}) {
  const pathname = usePathname()
  const router = useRouter()

  if (masquerSur.includes(pathname)) return null
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= profondeurAccueil) return null

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-accent-gold transition-colors mb-5"
    >
      <ArrowLeft size={15} /> Retour
    </button>
  )
}
