import { createClient } from '@/lib/supabase/server'
import { Panel, PageHeader } from '../../../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../../../_lib/getSoloOrg'
import { BoutonImprimer } from '../../../_components/BoutonImprimer'
import { EnteteImpression } from '../../../_components/EnteteImpression'

export default async function RapportBeneficiairePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()

  const [{ data: beneficiaire }, { data: evaluations }, { data: objectifs }] = await Promise.all([
    supabase.from('beneficiaires').select('id, nom, prenoms, statut_beneficiaire, created_at').eq('id', id).eq('organisation_id', organisation.id).single(),
    supabase.from('evaluations_iga').select('score_global, niveau, date_evaluation, commentaire').eq('beneficiaire_id', id).order('date_evaluation', { ascending: true }),
    supabase.from('objectifs_beneficiaire').select('titre, statut, date_cible, atteint_le').eq('beneficiaire_id', id).order('ordre').order('created_at'),
  ])

  if (!beneficiaire) return null

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const STATUT_LABEL: Record<string, string> = { a_venir: 'À venir', en_cours: 'En cours', atteint: 'Atteint' }

  return (
    <div className="max-w-3xl mx-auto py-10 px-6">
      <EnteteImpression organisation={organisation} />
      <PageHeader
        title={`Rapport de bilan — ${beneficiaire.nom} ${beneficiaire.prenoms}`}
        subtitle={`Généré le ${formatter.format(new Date())} par ${organisation.nom}. Destiné à être transmis à un parent ou une structure partenaire.`}
        actions={<BoutonImprimer />}
      />

      <Panel title="Suivi" className="mb-6">
        <p className="text-text-primary text-sm">Statut actuel : {beneficiaire.statut_beneficiaire}</p>
        <p className="text-text-muted text-xs mt-1">Suivi depuis le {formatter.format(new Date(beneficiaire.created_at))}</p>
      </Panel>

      <Panel title="Évolution du score IGA" className="mb-6">
        {(evaluations ?? []).length === 0 ? (
          <p className="text-text-muted text-sm">Aucune évaluation enregistrée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border-soft">
                <th className="py-2 font-medium text-xs uppercase">Date</th>
                <th className="py-2 font-medium text-xs uppercase">Score</th>
                <th className="py-2 font-medium text-xs uppercase">Niveau</th>
                <th className="py-2 font-medium text-xs uppercase">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {(evaluations ?? []).map((e: any, i: number) => (
                <tr key={i} className="border-b border-border-soft/60 last:border-0">
                  <td className="py-2 text-text-primary">{formatter.format(new Date(e.date_evaluation))}</td>
                  <td className="py-2 font-data text-text-primary">{e.score_global ?? '—'}/100</td>
                  <td className="py-2 text-text-muted">{e.niveau ?? '—'}</td>
                  <td className="py-2 text-text-muted">{e.commentaire ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Objectifs et jalons">
        {(objectifs ?? []).length === 0 ? (
          <p className="text-text-muted text-sm">Aucun objectif défini.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(objectifs ?? []).map((o: any, i: number) => (
              <li key={i} className="flex justify-between border-b border-border-soft/60 last:border-0 py-2">
                <span className="text-text-primary">{o.titre}</span>
                <span className="text-text-muted">
                  {STATUT_LABEL[o.statut] ?? o.statut}
                  {o.atteint_le ? ` — ${formatter.format(new Date(o.atteint_le))}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
