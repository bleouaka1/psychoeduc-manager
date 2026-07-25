'use client'

import { useState } from 'react'

export function SouscrireFormule({
  typeFormule,
  demarrer,
}: {
  typeFormule: 'base' | 'pack_2_matieres' | 'tout_inclus'
  demarrer: (typeFormule: 'base' | 'pack_2_matieres' | 'tout_inclus') => Promise<{ error: string | null }>
}) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function lancer() {
    setEnCours(true)
    setErreur(null)
    const res = await demarrer(typeFormule)
    setEnCours(false)
    if (res.error) setErreur(res.error)
  }

  return (
    <div>
      <button
        type="button"
        disabled={enCours}
        onClick={lancer}
        className="text-[12.5px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2 disabled:opacity-50"
      >
        {enCours ? '…' : 'S’abonner'}
      </button>
      {erreur && <p className="text-danger text-[11.5px] mt-2">{erreur}</p>}
    </div>
  )
}
