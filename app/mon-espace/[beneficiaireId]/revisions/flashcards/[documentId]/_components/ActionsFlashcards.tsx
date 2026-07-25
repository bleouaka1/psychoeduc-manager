'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function GenererFlashcardsButton({ generer }: { generer: () => Promise<{ error: string | null }> }) {
  const router = useRouter()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function lancer() {
    setEnCours(true)
    setErreur(null)
    const res = await generer()
    setEnCours(false)
    if (res.error) {
      setErreur(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <button type="button" disabled={enCours} onClick={lancer} className="text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2.5 disabled:opacity-50">
        {enCours ? 'Génération…' : 'Générer des flashcards (inclus dans l’abonnement)'}
      </button>
      {erreur && <p className="text-danger text-[13px] mt-2">{erreur}</p>}
    </div>
  )
}

export function GenererMnemotechniqueButton({ soldeCredits, generer }: { soldeCredits: number; generer: () => Promise<{ error: string | null }> }) {
  const router = useRouter()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function lancer() {
    setEnCours(true)
    setErreur(null)
    const res = await generer()
    setEnCours(false)
    if (res.error) {
      setErreur(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <button
        type="button"
        disabled={enCours || soldeCredits < 1}
        onClick={lancer}
        title={soldeCredits < 1 ? 'Crédits insuffisants' : undefined}
        className="text-[13px] font-semibold text-text-primary border border-accent-gold-dim rounded-full px-4 py-2.5 disabled:opacity-40"
      >
        {enCours ? 'Génération…' : `✦ Ajouter l’aide mnémotechnique IA (1 crédit — solde : ${soldeCredits})`}
      </button>
      {erreur && <p className="text-danger text-[13px] mt-2">{erreur}</p>}
    </div>
  )
}
