'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { SidebarNav } from './SidebarNav'

/** Tiroir latéral mobile/tablette (dashboard bénéficiaire v3, Lot G) — donne accès à
 * toutes les rubriques secondaires. Vient EN PLUS de la barre de navigation basse
 * (BottomNav), jamais à sa place : la barre basse reste l'accès rapide aux 4 écrans
 * les plus consultés, le tiroir donne accès à tout le reste. */
export function MobileDrawer() {
  const [ouvert, setOuvert] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="lg:hidden w-9 h-9 rounded-lg bg-bg-card border border-border-soft flex items-center justify-center text-text-muted hover:text-text-primary"
        aria-label="Menu"
      >
        <Menu size={16} />
      </button>

      {ouvert && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setOuvert(false)}>
          <div className="absolute top-0 left-0 bottom-0 w-[260px] bg-bg-surface border-r border-border-soft p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-cinzel text-[13px] text-accent-gold">Navigation</p>
              <button type="button" onClick={() => setOuvert(false)} className="text-text-muted hover:text-text-primary" aria-label="Fermer">
                <X size={16} />
              </button>
            </div>
            <SidebarNav variant="drawer" />
          </div>
        </div>
      )}
    </>
  )
}
