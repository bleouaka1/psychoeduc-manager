'use client'

import { useState } from 'react'
import type { FormulaireCv } from '@/lib/cv'

/**
 * Raccourci de saisie optionnel, réservé aux bénéficiaires (§2.2, révision) — jamais
 * une obligation : le formulaire fonctionne pleinement sans jamais cliquer ce bouton.
 */
export function PreremplirButton({
  preremplir,
  onPreremplir,
}: {
  preremplir: () => Promise<{ error: string | null; formulaire?: FormulaireCv }>
  onPreremplir: (formulaire: FormulaireCv) => void
}) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function lancer() {
    setEnCours(true)
    setErreur(null)
    const res = await preremplir()
    setEnCours(false)
    if (res.error || !res.formulaire) {
      setErreur(res.error ?? 'Impossible de pré-remplir le formulaire.')
      return
    }
    onPreremplir(res.formulaire)
  }

  return (
    <div className="mb-5">
      <button type="button" disabled={enCours} onClick={lancer} className="text-[12.5px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-4 py-2 disabled:opacity-50">
        {enCours ? 'Pré-remplissage…' : 'Pré-remplir depuis mon profil'}
      </button>
      {erreur && <p className="text-danger text-[12px] mt-1.5">{erreur}</p>}
    </div>
  )
}
