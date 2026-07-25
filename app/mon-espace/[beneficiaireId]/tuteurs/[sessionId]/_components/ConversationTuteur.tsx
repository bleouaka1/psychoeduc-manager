'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VoiceInput } from '@/app/mon-espace/_components/voix/VoiceInput'
import { SpeakButton } from '@/app/mon-espace/_components/voix/SpeakButton'

type Message = { id: string; role: 'user' | 'assistant'; contenu: string; createdAt: string }

export function ConversationTuteur({
  messagesInitiaux,
  sessionActive,
  envoyer,
  terminer,
}: {
  beneficiaireId: string
  sessionId: string
  messagesInitiaux: Message[]
  sessionActive: boolean
  envoyer: (message: string) => Promise<{ error: string | null }>
  terminer: () => Promise<{ error: string | null }>
}) {
  const router = useRouter()
  const [messages, setMessages] = useState(messagesInitiaux)
  const [texte, setTexte] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [terminee, setTerminee] = useState(!sessionActive)

  async function envoyerMessage() {
    const contenu = texte.trim()
    if (!contenu || enCours) return
    setEnCours(true)
    setErreur(null)
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', contenu, createdAt: new Date().toISOString() }])
    setTexte('')
    const res = await envoyer(contenu)
    setEnCours(false)
    if (res.error) {
      setErreur(res.error)
      return
    }
    router.refresh()
  }

  async function terminerSession() {
    setEnCours(true)
    const res = await terminer()
    setEnCours(false)
    if (res.error) {
      setErreur(res.error)
      return
    }
    setTerminee(true)
  }

  return (
    <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
      {messages.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-6">Écris ton premier message pour démarrer la conversation.</p>
      ) : (
        <ul className="space-y-3 mb-5">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`flex items-start gap-2 text-[13.5px] leading-relaxed rounded-xl px-4 py-2.5 max-w-[85%] ${
                m.role === 'user' ? 'bg-accent-gold/10 text-text-primary ml-auto' : 'bg-bg-surface text-text-primary'
              }`}
            >
              <span className="flex-1">{m.contenu}</span>
              {m.role === 'assistant' && <SpeakButton texte={m.contenu} taille={13} />}
            </li>
          ))}
        </ul>
      )}

      {erreur && <p className="text-danger text-[13px] mb-3">{erreur}</p>}

      {terminee ? (
        <p className="text-text-muted text-[13px]">Cette session est terminée.</p>
      ) : (
        <div className="flex gap-2.5">
          <input
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') envoyerMessage()
            }}
            placeholder="Écris ton message…"
            className="flex-1 bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
          />
          <VoiceInput onTranscript={(transcrit) => setTexte((t) => (t ? `${t} ${transcrit}` : transcrit))} />
          <button
            type="button"
            disabled={enCours || !texte.trim()}
            onClick={envoyerMessage}
            className="text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2 disabled:opacity-50"
          >
            {enCours ? '…' : 'Envoyer'}
          </button>
        </div>
      )}

      {!terminee && messages.length > 0 && (
        <button type="button" onClick={terminerSession} disabled={enCours} className="text-text-muted text-[12px] hover:text-danger mt-4">
          Terminer la session
        </button>
      )}
    </div>
  )
}
