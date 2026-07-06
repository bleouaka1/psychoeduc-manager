import { BarChart2, Trophy, ShoppingBag, Clock, Medal } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard } from '../_components/ui'

export default async function StatistiquesPage() {
  const supabase = await createClient()
  const [{ data: reussites }, { data: marketplace }, { data: insertion }, { data: support }, { data: carte }, { data: top100 }] =
    await Promise.all([
      supabase.from('vue_reussites').select('id'),
      supabase.from('vue_marketplace').select('*').single(),
      supabase.from('vue_insertion').select('*'),
      supabase.from('vue_support').select('*'),
      supabase.from('vue_carte_implantation').select('*'),
      supabase.from('vue_top100_iga').select('id').limit(1000),
    ])

  return (
    <>
      <PageHeader eyebrowIcon={BarChart2} eyebrowText="Gouvernance" title="Statistiques mondiales" subtitle="Panorama consolidé de la plateforme, toutes organisations." />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-8">
        <StatCard icon={Trophy} label="Réussites confirmées" value={reussites?.length ?? 0} />
        <StatCard icon={ShoppingBag} label="Offres marketplace publiées" value={marketplace?.offres_publiees ?? 0} />
        <StatCard icon={Clock} label="Offres en attente de validation" value={marketplace?.offres_en_attente ?? 0} />
        <StatCard icon={Medal} label="Bénéficiaires au Top 100 IGA" value={top100?.length ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Insertion professionnelle">
          <DataTable
            columns={['Statut', 'Type', 'Total']}
            rows={(insertion ?? []).map((i: any) => [i.statut, i.type_insertion ?? '—', i.total])}
            emptyText="Aucune insertion enregistrée."
          />
        </Panel>

        <Panel title="Support">
          <DataTable
            columns={['Statut', 'Priorité', 'Total']}
            rows={(support ?? []).map((s: any) => [s.statut, s.priorite, s.total])}
            emptyText="Aucun ticket enregistré."
          />
        </Panel>

        <Panel title="Carte d’implantation" className="lg:col-span-2">
          <DataTable
            columns={['Pays', 'Ville', 'Organisations']}
            rows={(carte ?? []).map((c: any) => [c.pays ?? '—', c.ville ?? '—', c.nb_organisations])}
            emptyText="Aucune implantation renseignée."
          />
        </Panel>
      </div>
    </>
  )
}
