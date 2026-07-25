'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { THEMES, type ThemeId } from '@/lib/preferencesUtilisateur'

const SWATCHES: Record<ThemeId, string[]> = {
  sombre_dore: ['#e2a545', '#4f8ff0', '#9b6bd6', '#3fae6a', '#d98a3d'],
  sobre_navy: ['#c9a24b', '#6fa287', '#8a7343', '#ece6d8', '#16233a'],
  terre_douce: ['#7bb28c', '#c9a86a', '#a8785a', '#e8ddc7', '#3d4a3d'],
  contraste_eleve: ['#ffd54a', '#4ade80', '#f87171', '#ffffff', '#000000'],
  bleu_nuit: ['#5fa8e0', '#8fb4d9', '#3d5a80', '#c9d6e3', '#152238'],
  mode_clair: ['#b8863f', '#5a8f6f', '#1b2333', '#ffffff', '#e3dcc8'],
  terracotta: ['#d97a4f', '#e8a672', '#8c4a2f', '#f0d9c4', '#2b1a12'],
  amethyste: ['#a878d9', '#c9a8e8', '#5f3d80', '#e3d4f0', '#1f1530'],
  monochrome: ['#dcdcdc', '#9a9a9a', '#6a6a6a', '#f0f0f0', '#2a2a2a'],
  sable_desert: ['#c9a55f', '#e0c99a', '#8a6d3f', '#f0e6d2', '#2b2317'],
}

export function ThemePicker({
  themeActuel,
  mettreAJour,
}: {
  themeActuel: ThemeId
  mettreAJour: (input: { themeId?: ThemeId }) => Promise<{ error: string | null }>
}) {
  const router = useRouter()
  const [selectionne, setSelectionne] = useState(themeActuel)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  function choisir(themeId: ThemeId) {
    setSelectionne(themeId)
    setErreur(null)
    startTransition(async () => {
      const res = await mettreAJour({ themeId })
      if (res.error) {
        setErreur(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            disabled={enCours}
            onClick={() => choisir(theme.id)}
            className={`text-left bg-bg-card border rounded-[12px] p-4 transition-colors disabled:opacity-60 ${
              selectionne === theme.id ? 'border-accent-gold' : 'border-border-soft hover:border-accent-gold-dim'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-text-primary text-[13.5px] font-medium">{theme.nom}</span>
              {selectionne === theme.id && <span className="text-accent-gold text-[12px]">✓ actif</span>}
            </div>
            <div className="flex gap-1.5 mb-2.5">
              {SWATCHES[theme.id].map((couleur, i) => (
                <span key={i} className="w-5 h-5 rounded-md" style={{ background: couleur }} />
              ))}
            </div>
            <p className="text-text-muted text-[11.5px]">{theme.description}</p>
          </button>
        ))}
      </div>
      {erreur && <p className="text-danger text-[13px] mt-3">{erreur}</p>}
    </div>
  )
}
