'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Compass, UserCircle2 } from 'lucide-react'

const ITEMS = [
  { key: 'accueil', label: 'Accueil', icon: Home, suffix: '' },
  { key: 'revisions', label: 'Révisions', icon: BookOpen, suffix: 'revisions' },
  { key: 'boussole', label: 'Boussole', icon: Compass, suffix: '#boussole' },
  { key: 'profil', label: 'Profil', icon: UserCircle2, suffix: '#profil-professionnel' },
] as const

/**
 * Barre de raccourcis rapides (dashboard bénéficiaire v2, Lot A) — vient en
 * SUPPLÉMENT de la page d'accueil catégorisée, jamais en remplacement : seulement 4
 * raccourcis vers les écrans les plus consultés. Les ~10 autres destinations (marketplace,
 * cercles, insertion/session pro, intelligence économique, capital social, CV, projets de
 * vie, notifications, tuteurs...) restent toutes accessibles depuis l'accueil catégorisé —
 * aucun lien retiré de la navigation normale.
 * Masquée sur le sélecteur `/mon-espace` (avant qu'un dossier ne soit choisi).
 */
export function BottomNav() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 2) return null

  const beneficiaireId = segments[1]
  const base = `/mon-espace/${beneficiaireId}`
  const sousChemin = segments.slice(2).join('/')

  return (
    <nav className="lg:hidden print:hidden fixed bottom-0 left-0 right-0 z-10 bg-bg-surface/95 backdrop-blur border-t border-border-soft">
      <div className="max-w-3xl mx-auto grid grid-cols-4">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const estAncre = item.suffix.startsWith('#')
          const cible = item.suffix === '' ? base : estAncre ? `${base}${item.suffix}` : `${base}/${item.suffix}`
          const actif = !estAncre && (item.suffix === '' ? sousChemin === '' : sousChemin === item.suffix || sousChemin.startsWith(`${item.suffix}/`))

          return (
            <Link
              key={item.key}
              href={cible}
              className={`flex flex-col items-center gap-1 py-3 text-[10.5px] font-data uppercase tracking-wide transition-colors ${
                actif ? 'text-accent-gold' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
