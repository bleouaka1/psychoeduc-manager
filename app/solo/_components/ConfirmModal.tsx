'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

/**
 * Bouton de suppression avec confirmation modale (thème sombre), cohérent avec le
 * reste de l'app plutôt qu'un window.confirm() natif. Si `bloque` est vrai (ex.
 * des inscriptions existent déjà), la modale explique pourquoi et ne propose pas
 * de confirmation — seulement une piste alternative (archiver).
 */
export function SupprimerAvecConfirmation({
  action,
  label = 'Supprimer',
  titreConfirmation,
  messageConfirmation,
  bloque = false,
  messageBloque,
}: {
  action: () => Promise<{ error: string | null }>
  label?: string
  titreConfirmation: string
  messageConfirmation: string
  bloque?: boolean
  messageBloque?: string
}) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function confirmer() {
    setEnCours(true)
    const res = await action()
    setEnCours(false)
    if (res?.error) {
      setErreur(res.error)
      return
    }
    setOuvert(false)
    // Appelée hors d'un <form action>, cette Server Action ne déclenche pas le rafraîchissement
    // automatique du routeur : revalidatePath() invalide bien le cache serveur, mais sans ce
    // router.refresh() la page déjà montée ne re-fetch pas tant qu'une navigation ne survient pas.
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex items-center gap-1 text-[12px] border border-danger/40 text-danger rounded-lg px-2.5 py-1.5"
      >
        <Trash2 size={13} /> {label}
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-bg-card border border-border-soft rounded-2xl p-6 max-w-sm w-full shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <h3 className="font-display text-lg text-text-primary mb-2">{titreConfirmation}</h3>
            {bloque ? (
              <>
                <p className="text-text-muted text-[13.5px] mb-5">{messageBloque}</p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOuvert(false)}
                    className="text-[13px] text-text-primary bg-bg-surface border border-border-soft rounded-full px-4 py-2"
                  >
                    Compris
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-text-muted text-[13.5px] mb-5">{messageConfirmation}</p>
                {erreur && <p className="text-danger text-[13px] mb-3">{erreur}</p>}
                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOuvert(false)}
                    className="text-[13px] text-text-muted hover:text-text-primary px-3.5 py-2"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={confirmer}
                    className="text-[13px] font-semibold text-bg-base bg-danger rounded-full px-4 py-2 disabled:opacity-60"
                  >
                    {enCours ? 'Suppression…' : 'Supprimer définitivement'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
