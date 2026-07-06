import { Gauge } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard, IgaDial } from '../_components/ui'

export default async function IgaPage() {
  const supabase = await createClient()
  const [{ data: referentiel }, { data: dimensions }, { data: evaluations }, { data: top100 }] = await Promise.all([
    supabase.from('referentiels_iga').select('version, description, date_effet').eq('actif', true).maybeSingle(),
    supabase.from('dimensions_iga').select('code, nom, ordre').order('ordre'),
    supabase
      .from('evaluations_iga')
      .select('id, score_global, niveau, date_evaluation, beneficiaires(nom, prenoms)')
      .order('date_evaluation', { ascending: false })
      .limit(50),
    supabase.from('vue_top100_iga').select('*').order('rang').limit(10),
  ])

  const moyenne =
    evaluations && evaluations.length > 0
      ? Math.round(evaluations.reduce((acc, e: any) => acc + Number(e.score_global ?? 0), 0) / evaluations.length)
      : null

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader
        eyebrowIcon={Gauge}
        eyebrowText="Parcours"
        title="IGA — Indice Général d’Autonomie"
        subtitle={`Référentiel actif : version ${referentiel?.version ?? '—'} (${dimensions?.length ?? 0} dimensions).`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-8">
        <IgaDial value={moyenne} label="Score moyen (50 dernières évaluations)" />
        <StatCard icon={Gauge} label="Évaluations récentes" value={evaluations?.length ?? 0} hint="50 dernières" />
        <StatCard icon={Gauge} label="Dimensions du référentiel" value={dimensions?.length ?? 0} />
        <StatCard icon={Gauge} label="Bénéficiaires au Top 10" value={top100?.length ?? 0} />
      </div>

      <div className="space-y-6">
        <Panel title="Dernières évaluations">
          <DataTable
            columns={['Bénéficiaire', 'Score', 'Niveau', 'Date']}
            rows={(evaluations ?? []).map((e: any) => [
              e.beneficiaires ? `${e.beneficiaires.nom} ${e.beneficiaires.prenoms}` : '—',
              e.score_global ?? '—',
              e.niveau ?? '—',
              formatter.format(new Date(e.date_evaluation)),
            ])}
            emptyText="Aucune évaluation IGA enregistrée pour le moment."
          />
        </Panel>

        <Panel title="Dimensions du référentiel actif">
          <DataTable
            columns={['Code', 'Nom', 'Ordre']}
            rows={(dimensions ?? []).map((d: any) => [d.code, d.nom, d.ordre])}
            emptyText="Aucune dimension définie."
          />
        </Panel>

        <Panel title="Top 10 IGA (extrait du Top 100)">
          <DataTable
            columns={['Rang', 'Score', 'Période']}
            rows={(top100 ?? []).map((t: any) => [t.rang, t.score_global, t.periode_type])}
            emptyText="Aucun classement calculé pour le moment."
          />
        </Panel>
      </div>
    </>
  )
}
