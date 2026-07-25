import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { QuizPlayer } from '../../_components/QuizPlayer'
import { enregistrerTentative } from '../../actions'

export default async function QuizPage({ params }: { params: Promise<{ beneficiaireId: string; quizId: string }> }) {
  const { beneficiaireId, quizId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  if (!dossiers.find((d) => d.id === beneficiaireId)) notFound()

  const { data: quiz } = await supabase
    .from('quiz_revision')
    .select('id, contenu_json, chrono_mode, chrono_duree_sec, palier, niveau_difficulte')
    .eq('id', quizId)
    .eq('beneficiaire_id', beneficiaireId)
    .single()

  if (!quiz) notFound()

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Révisions</p>
      <h1 className="font-cinzel font-semibold text-2xl text-text-primary mb-2">
        Quiz {quiz.palier === 'gratuit' ? 'standard' : quiz.niveau_difficulte === 'excellence' ? 'excellence' : 'soutenu'}
      </h1>
      {(quiz.contenu_json as any)?.minimumAtteint === false && (
        <p className="text-text-muted text-[12.5px] mb-6">
          Ce support est un peu court : {(quiz.contenu_json as any).questions.length} question(s) générée(s) au lieu des 50 habituelles. Ajoute un support complémentaire pour un quiz plus complet.
        </p>
      )}

      <QuizPlayer
        quizId={quiz.id}
        beneficiaireId={beneficiaireId}
        contenu={quiz.contenu_json as any}
        chronoMode={quiz.chrono_mode as 'par_question' | 'global' | 'aucun'}
        chronoDureeSec={quiz.chrono_duree_sec}
        enregistrerTentative={enregistrerTentative}
      />
    </div>
  )
}
