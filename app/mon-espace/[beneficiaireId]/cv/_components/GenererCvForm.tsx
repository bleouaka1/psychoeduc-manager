'use client'

import { useState } from 'react'

export function GenererCvForm({
  beneficiaireId,
  montant,
  devise,
  demarrer,
}: {
  beneficiaireId: string
  montant: number
  devise: string
  demarrer: (beneficiaireId: string) => Promise<{ error: string | null; generationId?: string; montant?: number; devise?: string }>
}) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState(false)

  async function lancer() {
    setEnCours(true)
    setErreur(null)
    const res = await demarrer(beneficiaireId)
    setEnCours(false)
    if (res.error) {
      setErreur(res.error)
      return
    }
    setSucces(true)
  }

  if (succes) {
    return <p className="text-status-ok text-[13.5px]">Demande créée — en attente de confirmation du paiement.</p>
  }

  return (
    <div>
      <button
        type="button"
        disabled={enCours}
        onClick={lancer}
        className="text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2.5 disabled:opacity-50"
      >
        {enCours ? 'Création de la demande…' : `Générer mon CV (${montant} ${devise})`}
      </button>
      {erreur && <p className="text-danger text-[13px] mt-2">{erreur}</p>}
    </div>
  )
}
