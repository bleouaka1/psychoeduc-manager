'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { contacterFormateur } from './actions'

export function ContacterFormateur({ organisationId, nomFormateur }: { organisationId: string; nomFormateur: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoye, setEnvoye] = useState(false)

  async function envoyer(formData: FormData) {
    setEnCours(true)
    const res = await contacterFormateur(organisationId, formData)
    setEnCours(false)
    if (res?.error) {
      setErreur(res.error)
      return
    }
    setEnvoye(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex items-center gap-1.5 bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2.5 rounded-full"
      >
        <MessageCircle size={14} /> Contacter
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-bg-card border border-border-soft rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-display text-lg text-text-primary mb-1">Contacter {nomFormateur}</h3>
            <p className="text-text-muted text-[12px] mb-3">Message envoyé via la messagerie interne — aucun email n'est partagé.</p>
            {envoye ? (
              <>
                <p className="text-accent-teal text-[13.5px] mb-4">Message envoyé.</p>
                <div className="flex justify-end">
                  <button type="button" onClick={() => setOuvert(false)} className="text-[13px] text-text-primary bg-bg-surface border border-border-soft rounded-full px-4 py-2">
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <form action={envoyer}>
                <textarea
                  name="contenu"
                  rows={4}
                  required
                  placeholder="Votre message…"
                  className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim mb-3"
                />
                {erreur && <p className="text-danger text-[13px] mb-2">{erreur}</p>}
                <div className="flex justify-end gap-2.5">
                  <button type="button" onClick={() => setOuvert(false)} className="text-[13px] text-text-muted hover:text-text-primary px-3.5 py-2">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={enCours}
                    className="text-[13px] font-semibold text-bg-base bg-gradient-to-br from-accent-gold to-accent-gold-dim rounded-full px-4 py-2 disabled:opacity-60"
                  >
                    {enCours ? 'Envoi…' : 'Envoyer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
