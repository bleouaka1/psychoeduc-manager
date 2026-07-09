import Link from 'next/link'
import { Gauge, TrendingUp, TrendingDown, Lightbulb, Users2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatusPill, IgaDial } from '../../../../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../../../../_lib/getSoloOrg'
import { NIVEAU_LABEL, CONSEIL_GENERIQUE_PAR_DIMENSION } from '@/lib/iga'
import { ajouterRecommandationIga } from '../actions'
import { ContacterFormateur } from '../../../../marketplace/formateur/ContacterFormateur'

export default async function ResultatEvaluationPage({ params }: { params: Promise<{ id: string; evaluationId: string }> }) {
  const { id, evaluationId } = await params
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()
  const { data: evaluation } = await supabase
    .from('evaluations_iga')
    .select('id, score_global, niveau, date_evaluation, commentaire, referentiels_iga(code, description)')
    .eq('id', evaluationId)
    .eq('organisation_id', organisation.id)
    .single()
  if (!evaluation) return null

  const { data: scores } = await supabase
    .from('scores_iga')
    .select('score, dimension_id, dimensions_iga(nom, code)')
    .eq('evaluation_id', evaluationId)
    .order('score', { ascending: false })

  const { data: recommandations } = await supabase
    .from('recommandations_iga')
    .select('id, dimension_id, recommandation, statut')
    .eq('evaluation_id', evaluationId)

  const scoresList = (scores ?? []) as any[]
  const fortes = scoresList.slice(0, 3)
  const faibles = [...scoresList].reverse().slice(0, 3)
  const referentiel = (evaluation as any).referentiels_iga

  // Mécanisme IGA → Marketplace (§4) : pour chaque dimension faible, praticiens
  // spécialisés triés par IPP, jamais bloquant si la base est vide (§5) — le
  // repli "Contacter le Fondateur" reste toujours disponible.
  const codesFaibles = faibles.map((s) => s.dimensions_iga?.code).filter(Boolean)
  const [{ data: praticiensSpecialises }, { data: organisationFondateurId }] = await Promise.all([
    codesFaibles.length > 0
      ? supabase
          .from('profils_publics_formateurs')
          .select('organisation_id, specialites_dimensions_iga, organisations(nom), vue_ipp(score)')
          .overlaps('specialites_dimensions_iga', codesFaibles)
          .neq('organisation_id', organisation.id)
      : Promise.resolve({ data: [] as any[] }),
    supabase.rpc('organisation_fondateur'),
  ])

  const praticiensParDimension = (codesFaibles as string[]).reduce<Record<string, any[]>>((acc, code) => {
    acc[code] = (praticiensSpecialises ?? [])
      .filter((p: any) => p.specialites_dimensions_iga?.includes(code))
      .sort((a: any, b: any) => (b.vue_ipp?.score ?? 0) - (a.vue_ipp?.score ?? 0))
    return acc
  }, {})

  return (
    <>
      <PageHeader
        eyebrowIcon={Gauge}
        eyebrowText="Mon espace Solo"
        title="Résultat de l'évaluation"
        subtitle={referentiel?.description ?? ''}
        actions={
          <Link
            href={`/solo/beneficiaires/${id}`}
            className="flex items-center gap-1.5 bg-bg-card border border-border-soft text-text-primary text-[13px] font-medium px-4 py-2.5 rounded-full"
          >
            Retour à la fiche
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <IgaDial value={evaluation.score_global} label="Score global" />
        <Panel title="Niveau">
          <StatusPill status={evaluation.score_global != null && evaluation.score_global >= 61 ? 'ok' : evaluation.score_global != null && evaluation.score_global <= 20 ? 'down' : 'idle'}>
            {NIVEAU_LABEL[evaluation.niveau ?? ''] ?? evaluation.niveau}
          </StatusPill>
          <p className="text-text-muted text-xs mt-3">
            Évalué le {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(evaluation.date_evaluation))}
          </p>
        </Panel>
        {evaluation.commentaire && (
          <Panel title="Commentaire">
            <p className="text-text-primary text-[13px] whitespace-pre-wrap">{evaluation.commentaire}</p>
          </Panel>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Dimensions les plus fortes" icon={TrendingUp}>
          <ul className="space-y-2">
            {fortes.map((s) => (
              <li key={s.dimension_id} className="flex justify-between text-[13.5px]">
                <span className="text-text-primary">{s.dimensions_iga?.nom}</span>
                <span className="font-data text-accent-teal">{s.score}/100</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Dimensions à travailler en priorité" icon={TrendingDown}>
          <ul className="space-y-4">
            {faibles.map((s) => {
              const code = s.dimensions_iga?.code
              const recosExistantes = (recommandations ?? []).filter((r: any) => r.dimension_id === s.dimension_id)
              return (
                <li key={s.dimension_id}>
                  <div className="flex justify-between text-[13.5px] mb-1.5">
                    <span className="text-text-primary">{s.dimensions_iga?.nom}</span>
                    <span className="font-data text-danger">{s.score}/100</span>
                  </div>
                  {code && CONSEIL_GENERIQUE_PAR_DIMENSION[code] && (
                    <p className="text-text-muted text-[12.5px] mb-2 flex items-start gap-1.5">
                      <Lightbulb size={12} className="text-accent-gold mt-0.5 shrink-0" /> {CONSEIL_GENERIQUE_PAR_DIMENSION[code]}
                    </p>
                  )}
                  {recosExistantes.length > 0 && (
                    <ul className="space-y-1 mb-2">
                      {recosExistantes.map((r: any) => (
                        <li key={r.id} className="text-text-muted text-[12.5px] flex items-start gap-1.5">
                          <Lightbulb size={12} className="text-accent-gold mt-0.5 shrink-0" /> {r.recommandation}
                        </li>
                      ))}
                    </ul>
                  )}
                  <form action={ajouterRecommandationIga.bind(null, evaluationId, s.dimension_id, id)} className="flex gap-2">
                    <input
                      name="recommandation"
                      placeholder="Piste d'action concrète…"
                      className="flex-1 bg-bg-surface border border-border-soft rounded-lg px-3 py-1.5 text-[12.5px] text-text-primary outline-none focus:border-accent-gold-dim"
                    />
                    <button type="submit" className="text-[12px] font-semibold text-bg-base bg-accent-gold rounded-full px-3 py-1.5 shrink-0">
                      Ajouter
                    </button>
                  </form>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="Mise en relation" icon={Users2}>
        <p className="text-text-muted text-[12.5px] mb-4">
          Praticiens spécialisés sur les dimensions à travailler en priorité, classés par indice de performance vérifié — ou contactez directement le Fondateur.
        </p>
        <div className="space-y-4 mb-4">
          {faibles.map((s) => {
            const code = s.dimensions_iga?.code
            const praticiens = code ? praticiensParDimension[code] ?? [] : []
            if (!code) return null
            return (
              <div key={s.dimension_id}>
                <p className="text-text-primary text-[13px] font-medium mb-2">{s.dimensions_iga?.nom}</p>
                {praticiens.length === 0 ? (
                  <p className="text-text-muted text-[12px]">Aucun praticien spécialisé disponible pour l’instant sur cette dimension.</p>
                ) : (
                  <ul className="space-y-2">
                    {praticiens.map((p: any) => (
                      <li key={p.organisation_id} className="flex items-center justify-between bg-bg-surface border border-border-soft rounded-xl px-3.5 py-2.5">
                        <span className="text-text-primary text-[13px]">
                          {p.organisations?.nom}{' '}
                          {p.vue_ipp?.score != null && <span className="text-text-muted text-[11px] font-data">— IPP {Math.round(p.vue_ipp.score)}</span>}
                        </span>
                        <ContacterFormateur organisationId={p.organisation_id} nomFormateur={p.organisations?.nom ?? 'ce praticien'} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
        <div className="border-t border-border-soft pt-4">
          {organisationFondateurId ? (
            <ContacterFormateur organisationId={organisationFondateurId as string} nomFormateur="le Fondateur" />
          ) : (
            <p className="text-text-muted text-[12px]">Aucun compte Fondateur trouvé.</p>
          )}
        </div>
      </Panel>
    </>
  )
}
