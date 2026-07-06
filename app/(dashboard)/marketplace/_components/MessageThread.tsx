'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'

export type MessageAffiche = {
  id: string
  contenu: string
  created_at: string
  auteur: string
  estFondateur: boolean
}

/**
 * Fil de messages d'une offre + formulaire d'envoi (Fondateur uniquement).
 * `action` est `envoyerMessageOffre` déjà liée à l'id de l'offre (bind).
 */
export function MessageThread({ messages, action }: { messages: MessageAffiche[]; action: (contenu: string) => Promise<{ error: string | null }> }) {
  const router = useRouter()
  const [contenu, setContenu] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  async function envoyer() {
    if (!contenu.trim()) return
    setEnCours(true)
    const res = await action(contenu)
    setEnCours(false)
    if (res?.error) {
      setErreur(res.error)
      return
    }
    setContenu('')
    setErreur(null)
    router.refresh()
  }

  return (
    <div>
      {messages.length === 0 ? (
        <p className="text-text-muted text-sm py-4 text-center">Aucun message pour cette offre pour le moment.</p>
      ) : (
        <ul className="space-y-3 mb-4 max-h-72 overflow-y-auto thin-scroll pr-1">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-xl px-3.5 py-2.5 text-[13px] max-w-[85%] ${
                m.estFondateur ? 'bg-accent-gold/10 border border-accent-gold-dim/40 ml-auto' : 'bg-bg-surface border border-border-soft'
              }`}
            >
              <p className="text-text-primary whitespace-pre-wrap">{m.contenu}</p>
              <p className="text-text-muted text-[11px] mt-1.5">
                {m.auteur} — {formatter.format(new Date(m.created_at))}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 items-end border-t border-border-soft pt-4">
        <textarea
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          placeholder="Écrire un message au vendeur au sujet de cette offre…"
          rows={2}
          className="flex-1 bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim resize-none"
        />
        <button
          type="button"
          disabled={enCours || !contenu.trim()}
          onClick={envoyer}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2.5 disabled:opacity-50 shrink-0"
        >
          <Send size={14} /> {enCours ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
      {erreur && <p className="text-danger text-[13px] mt-2">{erreur}</p>}
    </div>
  )
}
