'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ContenuQuiz } from '@/lib/quizRevision'

/** Passation du quiz + chronométrage (§6 du document).
 * - Palier gratuit : jauge PAR QUESTION (30-45s), visuelle, se vide — dépassement =
 *   passage automatique à la question suivante, AUCUNE pénalité de score.
 * - Palier payant : chrono GLOBAL affiché en MM:SS ("mode examen blanc").
 * Aucune gamification (pas de points/confettis) — encouragement sobre en fin de
 * session (§9 du document). */
export function QuizPlayer({
  quizId,
  beneficiaireId,
  contenu,
  chronoMode,
  chronoDureeSec,
  enregistrerTentative,
}: {
  quizId: string
  beneficiaireId: string
  contenu: ContenuQuiz
  chronoMode: 'par_question' | 'global' | 'aucun'
  chronoDureeSec: number | null
  enregistrerTentative: (quizId: string, beneficiaireId: string, reponses: Record<string, string>, score: number, tempsTotalSec: number) => Promise<{ error: string | null }>
}) {
  const router = useRouter()
  const questions = contenu.questions
  const [index, setIndex] = useState(0)
  const [reponses, setReponses] = useState<Record<string, string>>({})
  const [tempsRestantQuestion, setTempsRestantQuestion] = useState(chronoDureeSec ?? 40)
  const [tempsEcouleGlobal, setTempsEcouleGlobal] = useState(0)
  const [termine, setTermine] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)
  const debut = useRef(Date.now())

  const question = questions[index]

  useEffect(() => {
    if (termine) return
    const intervalle = setInterval(() => {
      setTempsEcouleGlobal((t) => t + 1)
      if (chronoMode === 'par_question') {
        setTempsRestantQuestion((t) => {
          if (t <= 1) {
            passerQuestionSuivante()
            return chronoDureeSec ?? 40
          }
          return t - 1
        })
      }
    }, 1000)
    return () => clearInterval(intervalle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, termine])

  function repondre(valeur: string) {
    setReponses((r) => ({ ...r, [question.id]: valeur }))
  }

  function passerQuestionSuivante() {
    if (index + 1 >= questions.length) {
      terminer()
    } else {
      setIndex((i) => i + 1)
      setTempsRestantQuestion(chronoDureeSec ?? 40)
    }
  }

  async function terminer() {
    setTermine(true)
    setEnregistrement(true)
    const bonnesReponses = questions.filter((q) => reponses[q.id] === q.reponseCorrecte).length
    const score = Math.round((bonnesReponses / questions.length) * 100)
    const tempsTotal = Math.round((Date.now() - debut.current) / 1000)
    await enregistrerTentative(quizId, beneficiaireId, reponses, score, tempsTotal)
    setEnregistrement(false)
  }

  if (questions.length === 0) {
    return <p className="text-text-muted text-sm py-10 text-center">Ce quiz n’a aucune question.</p>
  }

  if (termine) {
    const bonnesReponses = questions.filter((q) => reponses[q.id] === q.reponseCorrecte).length
    const score = Math.round((bonnesReponses / questions.length) * 100)
    return (
      <div className="bg-bg-card border border-border-soft rounded-[10px] p-8 text-center">
        <p className="font-data text-5xl text-accent-gold font-bold mb-2">{score}%</p>
        <p className="text-text-muted text-[14px] mb-6">
          {bonnesReponses} bonne(s) réponse(s) sur {questions.length}. {enregistrement ? 'Enregistrement…' : 'Progrès enregistré.'}
        </p>
        <button
          type="button"
          onClick={() => router.push(`/mon-espace/${beneficiaireId}/revisions`)}
          className="text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-5 py-2.5"
        >
          Retour aux révisions
        </button>
      </div>
    )
  }

  return (
    <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-text-muted text-[12px]">
          Question {index + 1} / {questions.length} — {question.categorie}
        </span>
        {chronoMode === 'global' ? (
          <span className="font-data text-text-primary text-[13px]">
            {String(Math.floor(tempsEcouleGlobal / 60)).padStart(2, '0')}:{String(tempsEcouleGlobal % 60).padStart(2, '0')}
          </span>
        ) : chronoMode === 'par_question' ? (
          <div className="w-24 h-1.5 bg-bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-gold rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${(tempsRestantQuestion / (chronoDureeSec ?? 40)) * 100}%` }}
            />
          </div>
        ) : null}
      </div>

      <p className="text-text-primary text-[15px] mb-5">{question.enonce}</p>

      {question.type === 'qcm' && question.options ? (
        <div className="space-y-2 mb-6">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => repondre(option)}
              className={`w-full text-left text-[13.5px] px-4 py-2.5 rounded-lg border transition-colors ${
                reponses[question.id] === option ? 'border-accent-gold bg-accent-gold/10 text-text-primary' : 'border-border-soft text-text-muted hover:text-text-primary'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <textarea
          value={reponses[question.id] ?? ''}
          onChange={(e) => repondre(e.target.value)}
          rows={4}
          placeholder="Rédige ta réponse…"
          className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim resize-none mb-6"
        />
      )}

      <button type="button" onClick={passerQuestionSuivante} className="text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-5 py-2.5">
        {index + 1 >= questions.length ? 'Terminer' : 'Question suivante'}
      </button>
    </div>
  )
}
