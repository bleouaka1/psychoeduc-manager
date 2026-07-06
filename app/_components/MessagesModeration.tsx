'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Send } from 'lucide-react'
import type { MessageModerationAffiche } from '@/lib/marketplaceMessages'

/** Fils de messages de modération groupés par offre, avec réponse — partagé entre
 * le module Compte Solo et le module Employeur (même table `messages`). */
export function MessagesModeration({
  messages,
  action,
}: {
  messages: MessageModerationAffiche[]
  action: (offreId: string, contenu: string) => Promise<{ error: string | null }>
}) {
  if (messages.length === 0) return <p className="text-text-muted text-sm py-4 text-center">Aucun message du Fondateur pour le moment.</p>

  const parOffre = new Map<string, { titre: string; messages: MessageModerationAffiche[] }>()
  for (const m of messages) {
    if (!parOffre.has(m.offreId)) parOffre.set(m.offreId, { titre: m.offreTitre, messages: [] })
    parOffre.get(m.offreId)!.messages.push(m)
  }

  return (
    <div className="space-y-4">
      {Array.from(parOffre.entries()).map(([offreId, groupe]) => (
        <FilOffre key={offreId} offreId={offreId} titre={groupe.titre} messages={groupe.messages} action={action} />
      ))}
    </div>
  )
}

function FilOffre({
  offreId,
  titre,
  messages,
  action,
}: {
  offreId: string
  titre: string
  messages: MessageModerationAffiche[]
  action: (offreId: string, contenu: string) => Promise<{ error: string | null }>
}) {
  const router = useRouter()
  const [contenu, setContenu] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  async function envoyer() {
    if (!contenu.trim()) return
    setEnCours(true)
    const res = await action(offreId, contenu)
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
    <div className="border border-border-soft rounded-xl p-4">
      <p className="text-[13px] text-text-primary font-medium mb-2.5 flex items-center gap-1.5">
        <MessageSquare size={14} className="text-accent-gold" /> {titre}
      </p>
      <ul className="space-y-2 mb-3">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-lg px-3 py-2 text-[12.5px] max-w-[85%] ${
              m.estMoi ? 'bg-accent-gold/10 border border-accent-gold-dim/40 ml-auto' : 'bg-bg-surface border border-border-soft'
            }`}
          >
            <p className="text-text-primary whitespace-pre-wrap">{m.contenu}</p>
            <p className="text-text-muted text-[10.5px] mt-1">
              {m.estMoi ? 'Vous' : 'Fondateur'} — {formatter.format(new Date(m.created_at))}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 items-end">
        <textarea
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          placeholder="Répondre au Fondateur…"
          rows={1}
          className="flex-1 bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent-gold-dim resize-none"
        />
        <button
          type="button"
          disabled={enCours || !contenu.trim()}
          onClick={envoyer}
          className="flex items-center gap-1 text-[12px] font-semibold text-bg-base bg-accent-gold rounded-full px-3 py-2 disabled:opacity-50 shrink-0"
        >
          <Send size={12} /> {enCours ? '…' : 'Répondre'}
        </button>
      </div>
      {erreur && <p className="text-danger text-[12px] mt-2">{erreur}</p>}
    </div>
  )
}
