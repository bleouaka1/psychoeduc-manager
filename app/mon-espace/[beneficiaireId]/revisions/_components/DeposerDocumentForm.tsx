'use client'

import { useActionState } from 'react'

export function DeposerDocumentForm({ action }: { action: (prevState: { error: string | null } | undefined, formData: FormData) => Promise<{ error: string | null }> }) {
  const [state, formAction, pending] = useActionState(action, undefined)

  return (
    <form action={formAction} className="space-y-3">
      <input
        name="nom_fichier"
        required
        placeholder="Titre (ex. Cours de menuiserie — semaine 3)"
        className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
      />
      <textarea
        name="contenu_texte"
        required
        rows={5}
        placeholder="Colle ici le contenu du support (texte déjà extrait du document)…"
        className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim resize-none"
      />
      {state?.error && <p className="text-danger text-[13px]">{state.error}</p>}
      <button type="submit" disabled={pending} className="text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2 disabled:opacity-60">
        {pending ? 'Dépôt…' : 'Déposer'}
      </button>
    </form>
  )
}
