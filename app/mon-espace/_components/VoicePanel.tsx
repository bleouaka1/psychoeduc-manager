'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Mic, Volume2, Sparkles, HelpCircle } from 'lucide-react'
import { VoiceInput } from './voix/VoiceInput'
import { interpreterCommandeVocale } from '@/lib/assistantVocal'

/**
 * Panneau assistant vocal (dashboard bénéficiaire v3, Lot K). Le bouton "Parler à
 * PsychoÉduc Manager" utilise le routage par mots-clés gratuit (§1.5) — si aucun
 * mot-clé ne matche, message honnête invitant à reformuler plutôt qu'un faux repli IA
 * (le repli Haiku pour phrase ambiguë n'est pas câblé : nécessiterait une action
 * serveur + ANTHROPIC_API_KEY, cohérent avec le reste des fonctionnalités IA bloquées).
 */
export function VoicePanel() {
  const pathname = usePathname()
  const router = useRouter()
  const segments = pathname.split('/').filter(Boolean)
  const beneficiaireId = segments.length >= 2 ? segments[1] : null
  const [message, setMessage] = useState<string | null>(null)

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

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-gradient-to-br from-accent-gold/15 to-accent-gold/5 border border-accent-gold-dim/30 rounded-2xl p-4 flex items-center gap-3">
        <VoiceInput onTranscript={traiterCommande} />
        <div>
          <p className="text-text-primary text-[12.5px] font-medium">Parler à PsychoÉduc Manager</p>
          <p className="text-text-muted text-[10.5px] mt-0.5">{message ?? 'Clique pour parler'}</p>
        </div>
      </div>

      <div>
        <p className="font-data text-[10.5px] tracking-[0.15em] text-text-muted uppercase mb-2.5">Accessibilité</p>
        <div className="grid grid-cols-2 gap-2">
          <Link href={base} className="bg-bg-card border border-border-soft rounded-xl p-3 text-center hover:border-accent-gold-dim transition-colors">
            <Mic size={16} className="mx-auto mb-1.5 text-text-muted" />
            <p className="text-text-primary text-[11px] font-medium">Parler</p>
            <p className="text-text-muted text-[9.5px]">Dictée vocale</p>
          </Link>
          <Link href={base} className="bg-bg-card border border-border-soft rounded-xl p-3 text-center hover:border-accent-gold-dim transition-colors">
            <Volume2 size={16} className="mx-auto mb-1.5 text-text-muted" />
            <p className="text-text-primary text-[11px] font-medium">Écouter</p>
            <p className="text-text-muted text-[9.5px]">Lecture audio</p>
          </Link>
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
