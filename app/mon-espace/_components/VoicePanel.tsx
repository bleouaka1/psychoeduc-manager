'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Mic, Volume2, Sparkles, HelpCircle, Square } from 'lucide-react'
import Link from 'next/link'
import { VoiceInput, type VoiceInputHandle } from './voix/VoiceInput'
import { interpreterCommandeVocale } from '@/lib/assistantVocal'

const HAUTEURS_ONDE = [6, 14, 20, 10, 18, 8, 16, 5, 12, 19]

const SUGGESTIONS = [
  "Explique-moi mon niveau d'autonomie",
  'Quelles sont mes prochaines révisions ?',
  'Aide-moi à comprendre ce document',
  'Montre-moi mes compétences',
  'Je veux parler à un tuteur',
]

const MESSAGE_ECOUTE = "Bienvenue sur ton espace PsychoÉduc Manager. Utilise le bouton micro pour parler, ou consulte les suggestions vocales ci-dessous."

/**
 * Panneau assistant vocal (dashboard bénéficiaire v3, Lot K, enrichi visuellement
 * suite au retour "trop froid/pas assez de détails") — routage par mots-clés gratuit
 * (§1.5), fonctionnel dès maintenant (le repli Haiku pour phrase ambiguë n'est pas
 * câblé, cohérent avec le reste des fonctionnalités IA bloquées sans ANTHROPIC_API_KEY).
 * Chaque bouton agit réellement : "Arrêter" coupe le micro via une ref impérative
 * (jamais un simple changement d'affichage sans effet réel sur la reconnaissance en
 * cours), "Parler"/"Écouter" déclenchent respectivement le même micro partagé et une
 * vraie lecture à voix haute (Web Speech API), jamais des liens décoratifs.
 */
export function VoicePanel() {
  const pathname = usePathname()
  const router = useRouter()
  const segments = pathname.split('/').filter(Boolean)
  const beneficiaireId = segments.length >= 2 ? segments[1] : null
  const [message, setMessage] = useState<string | null>(null)
  const [enEcoute, setEnEcoute] = useState(false)
  const micRef = useRef<VoiceInputHandle>(null)

  if (!beneficiaireId) return null

  const base = `/mon-espace/${beneficiaireId}`

  function traiterCommande(texte: string) {
    const destination = interpreterCommandeVocale(texte)
    if (!destination) {
      setMessage(`Je n'ai pas compris "${texte}" — essaie avec des mots comme réviser, tuteur, objectifs, compétences...`)
      return
    }
    setMessage(`Direction : ${destination.libelle}`)
    router.push(destination.suffixe.startsWith('#') ? `${base}${destination.suffixe}` : `${base}/${destination.suffixe}`)
  }

  function lireAVoixHaute(texte: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const enonce = new SpeechSynthesisUtterance(texte)
    enonce.lang = 'fr-FR'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(enonce)
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className="rounded-2xl p-4 flex items-center gap-3 border"
        style={{
          background: 'linear-gradient(155deg, color-mix(in srgb, var(--accent-gold) 24%, var(--bg-card)), color-mix(in srgb, var(--accent-gold) 6%, var(--bg-card)))',
          borderColor: 'color-mix(in srgb, var(--accent-gold) 40%, transparent)',
        }}
      >
        <div className="w-[52px] h-[52px] rounded-full bg-accent-gold flex items-center justify-center shrink-0 shadow-[0_0_18px_var(--accent-gold)]">
          <VoiceInput ref={micRef} onTranscript={traiterCommande} onListeningChange={setEnEcoute} />
        </div>
        <div className="min-w-0">
          <p className="text-text-primary text-[13px] font-semibold">Parler à PsychoÉduc Manager</p>
          <p className="text-text-muted text-[10.5px] mt-0.5 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${enEcoute ? 'bg-status-ok animate-pulse' : 'bg-text-muted'}`} />
            {message ?? (enEcoute ? 'En écoute…' : 'Clique pour parler')}
          </p>
        </div>
      </div>

      <div className="bg-bg-card border border-border-soft rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-text-primary text-[12px] font-semibold">Assistant vocal</p>
          {enEcoute && <span className="font-data text-[10px] text-status-ok">En écoute</span>}
        </div>
        <div className="flex items-end gap-[3px] h-[24px] mb-2">
          {HAUTEURS_ONDE.map((h, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-accent-gold"
              style={{ height: enEcoute ? `${h}px` : '3px', opacity: enEcoute ? 1 : 0.35, transition: 'height 0.2s ease' }}
            />
          ))}
        </div>
        {enEcoute ? (
          <button
            type="button"
            onClick={() => micRef.current?.arreter()}
            className="w-full flex items-center justify-center gap-2 border border-danger/50 text-danger rounded-full py-1.5 text-[12px] font-medium"
          >
            <Square size={11} /> Arrêter
          </button>
        ) : (
          <p className="text-text-muted text-[11px]">Micro inactif — clique sur le bouton doré pour parler.</p>
        )}
      </div>

      <div>
        <p className="font-data text-[10.5px] tracking-[0.15em] text-text-muted uppercase mb-2.5">Suggestions vocales</p>
        <div className="space-y-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => traiterCommande(s)}
              className="w-full text-left flex items-center gap-2 text-text-muted hover:text-accent-gold text-[12px] py-1.5 transition-colors"
            >
              <span className="text-accent-gold">▶</span> {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="font-data text-[10.5px] tracking-[0.15em] text-text-muted uppercase mb-2.5">Accessibilité</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => micRef.current?.demarrer()} className="bg-bg-card border border-border-soft rounded-xl p-3 text-center hover:border-accent-gold-dim transition-colors">
            <Mic size={16} className="mx-auto mb-1.5 text-text-muted" />
            <p className="text-text-primary text-[11px] font-medium">Parler</p>
            <p className="text-text-muted text-[9.5px]">Dictée vocale</p>
          </button>
          <button type="button" onClick={() => lireAVoixHaute(message ?? MESSAGE_ECOUTE)} className="bg-bg-card border border-border-soft rounded-xl p-3 text-center hover:border-accent-gold-dim transition-colors">
            <Volume2 size={16} className="mx-auto mb-1.5 text-text-muted" />
            <p className="text-text-primary text-[11px] font-medium">Écouter</p>
            <p className="text-text-muted text-[9.5px]">Lecture audio</p>
          </button>
          <Link href={`${base}/parametres`} className="bg-bg-card border border-border-soft rounded-xl p-3 text-center hover:border-accent-gold-dim transition-colors">
            <Sparkles size={16} className="mx-auto mb-1.5 text-text-muted" />
            <p className="text-text-primary text-[11px] font-medium">Mode simplifié</p>
            <p className="text-text-muted text-[9.5px]">Interface facile</p>
          </Link>
          <Link href={`${base}/parametres`} className="bg-bg-card border border-border-soft rounded-xl p-3 text-center hover:border-accent-gold-dim transition-colors">
            <HelpCircle size={16} className="mx-auto mb-1.5 text-text-muted" />
            <p className="text-text-primary text-[11px] font-medium">Aide</p>
            <p className="text-text-muted text-[9.5px]">Tutoriel</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
