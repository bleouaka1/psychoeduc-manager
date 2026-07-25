'use client'

import { useEffect, useState } from 'react'
import { Volume2, Square } from 'lucide-react'

/**
 * Bouton d'écoute réutilisable (dashboard bénéficiaire v3, Lot K) — Web Speech API du
 * navigateur (synthèse vocale), gratuit, aucun appel serveur. Vient toujours EN PLUS
 * du texte, jamais en remplacement (§1, handoff-vocal-layout-themes.md). Fallback
 * silencieux si le navigateur ne supporte pas l'API : le bouton disparaît plutôt que
 * de planter, jamais un bouton visible mais inerte.
 */
export function SpeakButton({ texte, taille = 13 }: { texte: string; taille?: number }) {
  const [supporte, setSupporte] = useState(false)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    setSupporte(typeof window !== 'undefined' && 'speechSynthesis' in window)
  }, [])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  if (!supporte) return null

  function basculer() {
    if (enCours) {
      window.speechSynthesis.cancel()
      setEnCours(false)
      return
    }
    const enonce = new SpeechSynthesisUtterance(texte)
    enonce.lang = 'fr-FR'
    enonce.onend = () => setEnCours(false)
    enonce.onerror = () => setEnCours(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(enonce)
    setEnCours(true)
  }

  return (
    <button
      type="button"
      onClick={basculer}
      title={enCours ? 'Arrêter la lecture' : 'Écouter'}
      aria-label={enCours ? 'Arrêter la lecture' : 'Écouter'}
      className="w-6.5 h-6.5 rounded-full bg-bg-surface flex items-center justify-center text-text-muted hover:text-accent-gold transition-colors shrink-0"
    >
      {enCours ? <Square size={taille - 2} /> : <Volume2 size={taille} />}
    </button>
  )
}
