'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Bouton de modération générique (Valider / Suspendre / Supprimer) avec confirmation
 * modale et motif optionnel — un seul composant pour les 3 actions plutôt que trois
 * quasi-identiques, cohérent avec le principe du projet de factoriser dès la 2e occurrence.
 *
 * `triggerIcon` prend un élément déjà rendu (ex. `<Trash2 size={13} />`), jamais le
 * composant lui-même : une fonction (le composant d'icône) ne peut pas traverser la
 * frontière Server → Client Component, contrairement à un élément JSX déjà construit.
 */
export function ModerationModal({
  action,
  triggerLabel,
  triggerIcon,
  triggerClassName,
  title,
  message,
  confirmLabel,
  confirmClassName,
  showMotif = false,
  motifPlaceholder = 'Motif (optionnel)…',
}: {
  action: (motif?: string) => Promise<{ error: string | null }>
  triggerLabel: string
  triggerIcon: ReactNode
  triggerClassName: string
  title: string
  message: string
  confirmLabel: string
  confirmClassName: string
  showMotif?: boolean
  motifPlaceholder?: string
}) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [motif, setMotif] = useState('')

  async function confirmer() {
    setEnCours(true)
    const res = await action(showMotif ? motif.trim() || undefined : undefined)
    setEnCours(false)
    if (res?.error) {
      setErreur(res.error)
      return
    }
    setOuvert(false)
    setMotif('')
    // Server Action appelée hors <form action> : revalidatePath() invalide le cache
    // serveur mais ne rafraîchit pas une page déjà montée sans ce router.refresh().
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={triggerClassName}>
        {triggerIcon} {triggerLabel}
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-bg-card border border-border-soft rounded-2xl p-6 max-w-sm w-full shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <h3 className="font-display text-lg text-text-primary mb-2">{title}</h3>
            <p className="text-text-muted text-[13.5px] mb-4">{message}</p>

            {showMotif && (
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder={motifPlaceholder}
                rows={3}
                className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim mb-4 resize-none"
              />
            )}

            {erreur && <p className="text-danger text-[13px] mb-3">{erreur}</p>}

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="text-[13px] text-text-muted hover:text-text-primary px-3.5 py-2"
              >
                Annuler
              </button>
              <button type="button" disabled={enCours} onClick={confirmer} className={`disabled:opacity-60 ${confirmClassName}`}>
                {enCours ? 'En cours…' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
