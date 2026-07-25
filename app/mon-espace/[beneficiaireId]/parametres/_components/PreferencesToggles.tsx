'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ModeInteraction } from '@/lib/preferencesUtilisateur'

const OPTIONS_INTERACTION: { id: ModeInteraction; label: string }[] = [
  { id: 'texte', label: 'Texte uniquement' },
  { id: 'vocal', label: 'Vocal uniquement' },
  { id: 'mixte', label: 'Texte + vocal (recommandé)' },
]

export function PreferencesToggles({
  modeAccessibiliteActuel,
  modeInteractionActuel,
  mettreAJour,
}: {
  modeAccessibiliteActuel: boolean
  modeInteractionActuel: ModeInteraction
  mettreAJour: (input: { modeAccessibilite?: boolean; modeInteraction?: ModeInteraction }) => Promise<{ error: string | null }>
}) {
  const router = useRouter()
  const [modeAccessibilite, setModeAccessibilite] = useState(modeAccessibiliteActuel)
  const [modeInteraction, setModeInteraction] = useState(modeInteractionActuel)
  const [erreur, setErreur] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function basculerAccessibilite() {
    const valeur = !modeAccessibilite
    setModeAccessibilite(valeur)
    startTransition(async () => {
      const res = await mettreAJour({ modeAccessibilite: valeur })
      if (res.error) setErreur(res.error)
      else router.refresh()
    })
  }

  function choisirInteraction(id: ModeInteraction) {
    setModeInteraction(id)
    startTransition(async () => {
      const res = await mettreAJour({ modeInteraction: id })
      if (res.error) setErreur(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-text-primary text-[13.5px] font-medium mb-1">Mode simplifié</p>
        <p className="text-text-muted text-[12px] mb-3">Grandes icônes, texte réduit au minimum — ne remplace jamais l’interface standard, tu peux revenir en arrière à tout moment.</p>
        <button
          type="button"
          onClick={basculerAccessibilite}
          className={`text-[13px] rounded-full px-4 py-2 border ${
            modeAccessibilite ? 'border-accent-gold text-accent-gold' : 'border-border-soft text-text-primary hover:border-accent-gold-dim'
          }`}
        >
          {modeAccessibilite ? 'Activé' : 'Désactivé'}
        </button>
      </div>

      <div>
        <p className="text-text-primary text-[13.5px] font-medium mb-1">Mode d’interaction</p>
        <p className="text-text-muted text-[12px] mb-3">La voix vient toujours en plus du texte, jamais en remplacement forcé.</p>
        <div className="flex flex-wrap gap-2.5">
          {OPTIONS_INTERACTION.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => choisirInteraction(option.id)}
              className={`text-[13px] rounded-full px-4 py-2 border ${
                modeInteraction === option.id ? 'border-accent-gold text-accent-gold' : 'border-border-soft text-text-primary hover:border-accent-gold-dim'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {erreur && <p className="text-danger text-[13px]">{erreur}</p>}
    </div>
  )
}
