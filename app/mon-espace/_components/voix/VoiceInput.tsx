'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'

/**
 * Bouton micro réutilisable (dashboard bénéficiaire v3, Lot K) — Web Speech API du
 * navigateur (reconnaissance vocale), gratuit, aucun appel serveur. Transcrit et
 * transmet le texte via `onTranscript` — n'insère jamais lui-même dans un champ,
 * c'est à l'appelant de décider quoi en faire (cohérent avec un seul micro réutilisable
 * pour plusieurs contextes : quiz, tuteur, recherche...). Fallback silencieux si le
 * navigateur ne supporte pas l'API (§1.1) : masqué plutôt que planté.
 */
export function VoiceInput({ onTranscript }: { onTranscript: (texte: string) => void }) {
  const [supporte, setSupporte] = useState(false)
  const [enEcoute, setEnEcoute] = useState(false)
  const reconnaissanceRef = useRef<any>(null)

  useEffect(() => {
    const Reconnaissance = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!Reconnaissance) return
    setSupporte(true)
    const instance = new Reconnaissance()
    instance.lang = 'fr-FR'
    instance.interimResults = false
    instance.maxAlternatives = 1
    instance.onresult = (e: any) => {
      const texte = e.results?.[0]?.[0]?.transcript
      if (texte) onTranscript(texte)
    }
    instance.onend = () => setEnEcoute(false)
    instance.onerror = () => setEnEcoute(false)
    reconnaissanceRef.current = instance
    return () => instance.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!supporte) return null

  function basculer() {
    if (enEcoute) {
      reconnaissanceRef.current?.stop()
      setEnEcoute(false)
      return
    }
    reconnaissanceRef.current?.start()
    setEnEcoute(true)
  }

  return (
    <button
      type="button"
      onClick={basculer}
      title={enEcoute ? 'Arrêter l’écoute' : 'Dicter au micro'}
      aria-label={enEcoute ? 'Arrêter l’écoute' : 'Dicter au micro'}
      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
        enEcoute ? 'bg-danger/20 text-danger' : 'bg-bg-surface border border-border-soft text-text-muted hover:text-accent-gold'
      }`}
    >
      {enEcoute ? <MicOff size={15} /> : <Mic size={15} />}
    </button>
  )
}
