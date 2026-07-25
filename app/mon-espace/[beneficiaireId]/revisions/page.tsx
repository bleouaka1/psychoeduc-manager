import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import {
  chargerDocumentsQuiz,
  chargerQuizzes,
  chargerSoldeCredits,
  chargerDatesCompletion,
  chargerReponsesNotions,
  chargerNoteEncouragementNonVue,
} from '@/lib/quizRevisionServer'
import { calculerFrequenceHebdomadaire, calculerProgressionParNotion, choisirNotionAvantApres } from '@/lib/quizRevisionEncouragement'
import { deposerDocument, validerDocumentQuiz, genererQuizGratuit, genererQuizPayant, ajouterNoteEncouragement, marquerNoteEncouragementVue } from './actions'
import { GenererQuizForm } from './_components/GenererQuizForm'
import { DeposerDocumentForm } from './_components/DeposerDocumentForm'
import { NoteEncouragementBanner } from './_components/NoteEncouragementBanner'

export default async function RevisionsPage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  // Cette page est aussi consultée par l'équipe pédagogique pour valider un support —
  // contrairement aux autres pages de /mon-espace (strictement self-service), l'accès
  // ne peut pas se limiter à "ce dossier m'appartient" (chargerDossiersBeneficiaire).
  // RLS protège déjà la lecture réelle des données ; ce garde-fou applicatif sert
  // uniquement à distinguer "dossier inexistant" (404) de "pas encore de droits".
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  const dossiers = await chargerDossiersBeneficiaire(supabase)
  const estProprietaire = dossiers.some((d) => d.id === beneficiaireId)

  if (!estProprietaire && !estFondateur) {
    const { data: beneficiaireCible } = await supabase.from('beneficiaires').select('organisation_id').eq('id', beneficiaireId).maybeSingle()
    if (!beneficiaireCible) notFound()
    const { data: peutLire } = await supabase.rpc('peut_lire', { p_module: 'quiz_revision', p_organisation_id: beneficiaireCible.organisation_id })
    if (!peutLire) notFound()
  }

  const [documents, quizzes, solde, datesCompletion, reponsesNotions, noteEncouragement] = await Promise.all([
    chargerDocumentsQuiz(supabase, beneficiaireId),
    chargerQuizzes(supabase, beneficiaireId),
    chargerSoldeCredits(supabase, beneficiaireId),
    chargerDatesCompletion(supabase, beneficiaireId),
    chargerReponsesNotions(supabase, beneficiaireId),
    chargerNoteEncouragementNonVue(supabase, beneficiaireId),
  ])

  const frequenceHebdo = calculerFrequenceHebdomadaire(datesCompletion)
  const progressionNotions = calculerProgressionParNotion(reponsesNotions)
  const notionsARappeler = progressionNotions.filter((p) => p.meriteRappel).slice(0, 5)
  const notionAvantApres = choisirNotionAvantApres(progressionNotions)

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Bibliothèque</p>
      <h1 className="font-cinzel font-semibold text-3xl text-text-primary mb-1">Révisions</h1>
      <p className="text-text-muted text-sm mb-2">Dépose un support de formation, obtiens un quiz pour réviser à ton rythme.</p>
      <p className="text-text-muted text-[12.5px] mb-7">
        Solde de crédits (mode approfondi) : <span className="font-data text-accent-gold">{solde}</span>
      </p>

      {noteEncouragement && (
        <NoteEncouragementBanner message={noteEncouragement.message} onVue={marquerNoteEncouragementVue.bind(null, beneficiaireId, noteEncouragement.id)} />
      )}

      {(datesCompletion.length > 0 || estFondateur) && (
        <div className="bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6">
          <h2 className="font-cinzel text-[15px] text-text-primary mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-accent-gold" /> Ma progression
          </h2>
          <p className="text-text-muted text-[13.5px] mb-3">
            {frequenceHebdo > 0
              ? `Tu as révisé ${frequenceHebdo} jour(s) cette semaine.`
              : 'Aucune révision cette semaine — reprends à ton rythme, sans pression.'}
          </p>
          {notionAvantApres && (
            <p className="text-text-muted text-[13.5px] mb-3">
              Progrès réel sur « {notionAvantApres.notion} » : raté le {formatter.format(notionAvantApres.premiereDate)} → réussi le{' '}
              {formatter.format(notionAvantApres.derniereDate)}.
            </p>
          )}
          {notionsARappeler.length > 0 && (
            <div>
              <p className="text-text-muted text-[12.5px] mb-1.5">Ces notions méritent un rappel :</p>
              <div className="flex flex-wrap gap-1.5">
                {notionsARappeler.map((n) => (
                  <span key={n.notion} className="text-[12px] text-accent-gold border border-accent-gold-dim/40 rounded-full px-2.5 py-1">
                    {n.notion}
                  </span>
                ))}
              </div>
            </div>
          )}

          {estFondateur && (
            <form action={ajouterNoteEncouragement.bind(null, beneficiaireId)} className="flex flex-wrap gap-2.5 mt-4 pt-4 border-t border-border-soft">
              <input
                name="message"
                placeholder="Un mot de reconnaissance pour ce bénéficiaire…"
                className="flex-1 min-w-[220px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
              />
              <button type="submit" className="text-[13px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-4 py-2">
                Envoyer
              </button>
            </form>
          )}
        </div>
      )}

      <div className="bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6">
        <h2 className="font-cinzel text-[15px] text-text-primary mb-4">Déposer un nouveau support</h2>
        <DeposerDocumentForm action={deposerDocument.bind(null, beneficiaireId)} />
      </div>

      <div className="bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6">
        <h2 className="font-cinzel text-[15px] text-text-primary mb-4">Mes supports</h2>
        {documents.length === 0 ? (
          <p className="text-text-muted text-sm py-4 text-center">Aucun support déposé pour le moment.</p>
        ) : (
          <ul className="space-y-4">
            {documents.map((d) => (
              <li key={d.id} className="border-b border-border-soft last:border-0 pb-4 last:pb-0">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <p className="text-text-primary text-[13.5px] font-medium flex items-center gap-1.5">
                    <BookOpen size={14} className="text-accent-gold shrink-0" /> {d.nomFichier}
                  </p>
                  {d.valideAt ? (
                    <span className="text-status-ok text-[11.5px] flex items-center gap-1">
                      <CheckCircle2 size={12} /> Validé par {d.valideParNom}
                    </span>
                  ) : (
                    <span className="text-text-muted text-[11.5px] flex items-center gap-1">
                      <Clock size={12} /> En attente de validation
                    </span>
                  )}
                </div>

                {!d.valideAt && estFondateur && (
                  <form action={validerDocumentQuiz.bind(null, beneficiaireId, d.id)}>
                    <button type="submit" className="text-[12px] text-status-ok border border-status-ok/40 rounded-full px-3 py-1.5">
                      Valider ce support
                    </button>
                  </form>
                )}

                {d.valideAt && (
                  <>
                    <GenererQuizForm
                      documentId={d.id}
                      beneficiaireId={beneficiaireId}
                      soldeCredits={solde}
                      genererGratuit={genererQuizGratuit.bind(null, beneficiaireId)}
                      genererPayant={genererQuizPayant.bind(null, beneficiaireId)}
                    />
                    <Link href={`/mon-espace/${beneficiaireId}/revisions/flashcards/${d.id}`} className="text-accent-gold text-[12px] mt-2 inline-block hover:underline">
                      Voir mes flashcards →
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
        <h2 className="font-cinzel text-[15px] text-text-primary mb-4">Mes quiz</h2>
        {quizzes.length === 0 ? (
          <p className="text-text-muted text-sm py-4 text-center">Aucun quiz généré pour le moment.</p>
        ) : (
          <ul className="space-y-2.5">
            {quizzes.map((q) => (
              <li key={q.id} className="flex items-center justify-between text-[13.5px] border-b border-border-soft last:border-0 pb-2.5 last:pb-0">
                <div>
                  <Link href={`/mon-espace/${beneficiaireId}/revisions/quiz/${q.id}`} className="text-accent-gold hover:underline">
                    {q.documentNom}
                  </Link>
                  <p className="text-text-muted text-[11.5px]">
                    {q.palier === 'gratuit' ? 'Standard' : q.niveauDifficulte === 'excellence' ? 'Excellence' : 'Soutenu'} — {formatter.format(new Date(q.createdAt))}
                  </p>
                </div>
                <span className="font-data text-text-muted text-[12.5px]">{q.meilleurScore != null ? `${q.meilleurScore}%` : '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
