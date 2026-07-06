'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing } from 'lucide-react'
import { relancerEleve } from '../formations/relance-actions'

/**
 * Relance d'un élève inactif : un message est SUGGÉRÉ (pré-rempli), jamais envoyé
 * sans que le formateur clique explicitement sur "Envoyer" depuis cette modale.
 */
export function RelancerEleve({ acheteurId, nomFormation }: { acheteurId: string; nomFormation: string }) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const suggestion = `Bonjour, je remarque que votre progression sur « ${nomFormation} » n'a pas avancé récemment. Puis-je vous aider à reprendre ?`

  async function envoyer(formData: FormData) {
    setEnCours(true)
    const res = await relancerEleve(acheteurId, formData)
    setEnCours(false)
    if (res?.error) {
      setErreur(res.error)
      return
    }
    setOuvert(false)
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className="flex items-center gap-1 text-[11px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-2.5 py-1">
        <BellRing size={11} /> Relancer
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-bg-card border border-border-soft rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-display text-lg text-text-primary mb-3">Relancer cet élève</h3>
            <form action={envoyer}>
              <textarea
                name="contenu"
                rows={4}
                defaultValue={suggestion}
                className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim mb-3"
              />
              {erreur && <p className="text-danger text-[13px] mb-2">{erreur}</p>}
              <div className="flex justify-end gap-2.5">
                <button type="button" onClick={() => setOuvert(false)} className="text-[13px] text-text-muted hover:text-text-primary px-3.5 py-2">
                  Annuler
                </button>
                <button type="submit" disabled={enCours} className="text-[13px] font-semibold text-bg-base bg-gradient-to-br from-accent-gold to-accent-gold-dim rounded-full px-4 py-2 disabled:opacity-60">
                  {enCours ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
