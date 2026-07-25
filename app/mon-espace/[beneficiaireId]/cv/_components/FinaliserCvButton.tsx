'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Bouton défensif : n'a d'effet réel qu'une fois le paiement confirmé par le webhook
 * du prestataire (statut 'confirme') — inatteignable en pratique tant qu'aucun
 * prestataire n'est câblé (cf. actions.ts), mais permet de finaliser manuellement une
 * génération déjà confirmée sans attendre un mécanisme de rafraîchissement automatique. */
export function FinaliserCvButton({
  beneficiaireId,
  generationId,
  finaliser,
}: {
  beneficiaireId: string
  generationId: string
  finaliser: (beneficiaireId: string, generationId: string) => Promise<{ error: string | null }>
}) {
  const router = useRouter()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function lancer() {
    setEnCours(true)
    setErreur(null)
    const res = await finaliser(beneficiaireId, generationId)
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
        disabled={enCours}
        onClick={lancer}
        className="text-[12px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-3 py-1.5 disabled:opacity-50"
      >
        {enCours ? 'Génération…' : 'Finaliser la génération'}
      </button>
      {erreur && <p className="text-danger text-[12px] mt-1.5">{erreur}</p>}
    </div>
  )
}
