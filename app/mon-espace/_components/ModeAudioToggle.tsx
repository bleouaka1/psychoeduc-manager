'use client'

import { useState } from 'react'
import { Volume2 } from 'lucide-react'

/**
 * Bascule rapide "Mode audio" en accès direct sur l'écran principal (retour
 * utilisateur : le mode audio n'existe aujourd'hui que noyé dans Paramètres,
 * jamais visible en un clic comme dans la maquette de référence). Bascule
 * `mode_interaction` entre 'texte' et 'mixte' — jamais 'vocal' seul depuis ce
 * raccourci, la voix vient toujours en plus du texte, jamais en remplacement.
 */
export function ModeAudioToggle({
  actifParDefaut,
  mettreAJour,
}: {
  actifParDefaut: boolean
  mettreAJour: (input: { modeInteraction: 'texte' | 'mixte' }) => Promise<{ error: string | null }>
}) {
  const [actif, setActif] = useState(actifParDefaut)
  const [enCours, setEnCours] = useState(false)

  async function basculer() {
    const nouvelleValeur = !actif
    setActif(nouvelleValeur)
    setEnCours(true)
    await mettreAJour({ modeInteraction: nouvelleValeur ? 'mixte' : 'texte' })
    setEnCours(false)
  }

  return (
    <button
      type="button"
      onClick={basculer}
      disabled={enCours}
      className="flex items-center gap-2.5 bg-bg-card border border-border-soft rounded-full px-3.5 py-2 text-[12.5px] text-text-primary disabled:opacity-70"
    >
      <Volume2 size={14} className="text-accent-gold" />
      Mode audio
      <span className={`relative w-8 h-[18px] rounded-full transition-colors ${actif ? 'bg-accent-gold' : 'bg-border-soft'}`}>
        <span
          className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform"
          style={{ transform: actif ? 'translateX(14px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  )
}
