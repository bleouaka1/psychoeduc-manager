'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { laisserAvis } from '../avis-actions'

export function NoterFormation({
  formationId,
  organisationId,
  noteActuelle,
  commentaireActuel,
}: {
  formationId: string
  organisationId: string
  noteActuelle: number | null
  commentaireActuel: string | null
}) {
  const [note, setNote] = useState(noteActuelle ?? 0)

  return (
    <form action={laisserAvis.bind(null, formationId, organisationId)} className="flex items-center gap-2 mt-2">
      <input type="hidden" name="note" value={note} />
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setNote(n)} aria-label={`${n} étoile(s)`}>
            <Star size={15} className={n <= note ? 'text-accent-gold fill-accent-gold' : 'text-text-muted'} />
          </button>
        ))}
      </div>
      <input
        name="commentaire"
        defaultValue={commentaireActuel ?? ''}
        placeholder="Un commentaire (optionnel)…"
        className="flex-1 bg-bg-surface border border-border-soft rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent-gold-dim"
      />
      <button type="submit" disabled={note === 0} className="text-[11.5px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-3 py-1.5 disabled:opacity-40">
        {noteActuelle ? 'Modifier' : 'Envoyer'}
      </button>
    </form>
  )
}
