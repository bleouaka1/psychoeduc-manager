'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SpeakButton } from './voix/SpeakButton'

export type ActiviteRecente = {
  cle: string
  tag: string
  couleur: string
  titre: string
  sous?: string
  pourcentage?: number
  bouton: string
  href: string
}

/** Carrousel "Reprendre mon activité" (dashboard bénéficiaire v3) — les activités sont
 * affichées du plus important au moins important, de gauche à droite (ordre déjà fixé
 * par l'appelant dans `activitesRecentes`). Les flèches gauche/droite signalent qu'il
 * peut y avoir plus d'activités en cours que ce qui tient à l'écran — utile dès
 * aujourd'hui sur mobile, et de plus en plus utile à mesure que de nouveaux types
 * d'activité s'ajoutent (cf. lib/activiteCouleurs.ts). Apparaissent/disparaissent selon
 * qu'on peut effectivement défiler dans ce sens, jamais des flèches décoratives. */
export function ActivitesCarousel({ activites }: { activites: ActiviteRecente[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [peutReculer, setPeutReculer] = useState(false)
  const [peutAvancer, setPeutAvancer] = useState(false)

  function verifierScroll() {
    const el = scrollRef.current
    if (!el) return
    setPeutReculer(el.scrollLeft > 4)
    setPeutAvancer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    verifierScroll()
    window.addEventListener('resize', verifierScroll)
    return () => window.removeEventListener('resize', verifierScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activites.length])

  function defiler(direction: -1 | 1) {
    scrollRef.current?.scrollBy({ left: direction * 288, behavior: 'smooth' })
  }

  return (
    <div className="relative mb-8">
      {peutReculer && (
        <button
          type="button"
          onClick={() => defiler(-1)}
          aria-label="Activités précédentes"
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-bg-card border border-border-soft flex items-center justify-center text-text-muted hover:text-accent-gold hover:border-accent-gold-dim transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {peutAvancer && (
        <button
          type="button"
          onClick={() => defiler(1)}
          aria-label="Activités suivantes"
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-bg-card border border-border-soft flex items-center justify-center text-text-muted hover:text-accent-gold hover:border-accent-gold-dim transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
        >
          <ChevronRight size={16} />
        </button>
      )}
      <div ref={scrollRef} onScroll={verifierScroll} className="flex gap-3.5 overflow-x-auto thin-scroll snap-x snap-mandatory scroll-smooth pb-1">
        {activites.map((a) => (
          <Link
            key={a.cle}
            href={a.href}
            className="rounded-2xl p-4 border-[1.5px] block transition-transform hover:-translate-y-0.5 relative overflow-hidden shrink-0 w-[270px] snap-start"
            style={{
              background: `linear-gradient(155deg, color-mix(in srgb, ${a.couleur} 28%, var(--bg-card)), color-mix(in srgb, ${a.couleur} 10%, var(--bg-card)))`,
              borderColor: `color-mix(in srgb, ${a.couleur} 45%, transparent)`,
              boxShadow: `0 4px 16px color-mix(in srgb, ${a.couleur} 18%, transparent)`,
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span
                className="font-data text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full inline-block"
                style={{ background: `color-mix(in srgb, ${a.couleur} 35%, transparent)`, color: '#fff' }}
              >
                {a.tag}
              </span>
              <SpeakButton texte={`${a.tag} : ${a.titre}. ${a.sous ?? ''}`} taille={12} />
            </div>
            <p className="text-text-primary text-[13.5px] font-semibold leading-tight mb-1">{a.titre}</p>
            {a.sous && <p className="text-text-muted text-[11px] mb-2">{a.sous}</p>}
            {a.pourcentage != null && (
              <div className="h-1.5 bg-black/25 rounded-full overflow-hidden mb-2.5">
                <div className="h-full rounded-full" style={{ width: `${a.pourcentage}%`, background: a.couleur, boxShadow: `0 0 6px ${a.couleur}` }} />
              </div>
            )}
            <span className="text-[11.5px] font-bold" style={{ color: a.couleur }}>
              {a.bouton} →
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
