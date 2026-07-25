'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RECOMMANDATION_OBJECTIF, type PreferenceObjectif } from '@/lib/quizRevision'

/** Écran de préférence (§3 du document) : mapping statique objectif → format conseillé,
 * aucune génération dynamique. Le bénéficiaire reste toujours libre de choisir un
 * format différent de celui recommandé, y compris s'il n'a pas de crédits (repli
 * automatique sur le palier gratuit). Ce choix n'est jamais mémorisé d'une session
 * à l'autre — réaffiché à chaque nouvelle génération. */
export function GenererQuizForm({
  documentId,
  beneficiaireId,
  soldeCredits,
  genererGratuit,
  genererPayant,
}: {
  documentId: string
  beneficiaireId: string
  soldeCredits: number
  genererGratuit: (documentId: string, preference: PreferenceObjectif) => Promise<{ error: string | null; quizId?: string }>
  genererPayant: (documentId: string, niveau: 'soutenu' | 'excellence') => Promise<{ error: string | null; quizId?: string }>
}) {
  const router = useRouter()
  const [preference, setPreference] = useState<PreferenceObjectif | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function lancer(palier: 'gratuit' | 'payant') {
    if (!preference) return
    setEnCours(true)
    setErreur(null)
    const res =
      palier === 'gratuit'
        ? await genererGratuit(documentId, preference)
        : await genererPayant(documentId, preference === 'excellence' ? 'excellence' : 'soutenu')
    setEnCours(false)
    if (res.error) {
      setErreur(res.error)
      return
    }
    router.push(`/mon-espace/${beneficiaireId}/revisions/quiz/${res.quizId}`)
  }

  if (!preference) {
    return (
      <div className="bg-bg-surface border border-border-soft rounded-xl p-4">
        <p className="text-text-primary text-[13.5px] font-medium mb-3">Qu’est-ce qui t’aiderait le plus aujourd’hui ?</p>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setPreference('rapide')}
            className="text-[13px] text-text-primary border border-border-soft rounded-full px-4 py-2 hover:border-accent-gold-dim"
          >
            Réviser vite
          </button>
          <button
            type="button"
            onClick={() => setPreference('excellence')}
            className="text-[13px] text-text-primary border border-border-soft rounded-full px-4 py-2 hover:border-accent-gold-dim"
          >
            Viser l’excellence
          </button>
        </div>
      </div>
    )
  }

  const recommandation = RECOMMANDATION_OBJECTIF[preference]

  return (
    <div className="bg-bg-surface border border-border-soft rounded-xl p-4">
      <p className="text-text-muted text-[13px] mb-4">{recommandation.message}</p>

      <div className="flex flex-wrap gap-2.5 mb-3">
        <button
          type="button"
          disabled={enCours}
          onClick={() => lancer('gratuit')}
          className="text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2 disabled:opacity-50"
        >
          {enCours ? 'Génération…' : 'QCM standard (gratuit, illimité)'}
        </button>
        <button
          type="button"
          disabled={enCours || soldeCredits < 1}
          onClick={() => lancer('payant')}
          className="text-[13px] font-semibold text-text-primary border border-accent-gold-dim rounded-full px-4 py-2 disabled:opacity-40"
          title={soldeCredits < 1 ? 'Crédits insuffisants' : undefined}
        >
          {enCours ? 'Génération…' : `Mode approfondi (1 crédit — solde: ${soldeCredits})`}
        </button>
      </div>
      {soldeCredits < 1 && preference === 'excellence' && (
        <p className="text-text-muted text-[12px] mb-2">Pas assez de crédits pour le mode approfondi — tu peux continuer en QCM gratuit en attendant.</p>
      )}
      {erreur && <p className="text-danger text-[13px] mb-2">{erreur}</p>}
      <button type="button" onClick={() => setPreference(null)} className="text-text-muted text-[12px] hover:text-text-primary">
        ← Changer de préférence
      </button>
    </div>
  )
}
