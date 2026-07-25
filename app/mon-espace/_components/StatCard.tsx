import Link from 'next/link'
import type { ReactNode } from 'react'
import { SpeakButton } from './voix/SpeakButton'

/** Carte stat du dashboard bénéficiaire v3 (IGA, ICC, Crédits, Objectifs) — l'IGA n'est
 * plus l'élément héro visuel unique, elle est une carte parmi les autres (décision
 * actée, handoff-vocal-layout-themes.md §2.4). */
export function StatCard({
  label,
  valeur,
  suffixe,
  detail,
  lien,
  visuel,
  texteVocal,
}: {
  label: string
  valeur: ReactNode
  suffixe?: string
  detail: string
  lien?: { href: string; texte: string }
  visuel?: ReactNode
  /** Phrase à lire à voix haute — texte simple, distinct de `valeur` (ReactNode). */
  texteVocal: string
}) {
  return (
    <div className="bg-bg-card border border-border-soft rounded-2xl p-4 relative">
      <div className="absolute top-3 right-3">
        <SpeakButton texte={texteVocal} />
      </div>
      <p className="text-text-muted text-[11px] mb-2">{label}</p>
      <div className="flex items-center gap-2.5 mb-1.5">
        {visuel}
        <p className="font-data text-[24px] font-bold text-text-primary leading-none">
          {valeur}
          {suffixe && <span className="text-[12px] text-text-muted font-normal">{suffixe}</span>}
        </p>
      </div>
      {lien ? (
        <Link href={lien.href} className="text-accent-gold text-[11px] font-semibold hover:underline">
          {lien.texte}
        </Link>
      ) : (
        <p className="text-text-muted text-[11px]">{detail}</p>
      )}
    </div>
  )
}
