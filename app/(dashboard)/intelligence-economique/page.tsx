import { LineChart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard } from '../_components/ui'

export default async function IntelligenceEconomiquePage() {
  const supabase = await createClient()
  const [{ data: opportunites }, { data: concours }, { data: bourses }, { data: financements }, { data: metiers }, { data: analyses }] =
    await Promise.all([
      supabase.from('opportunites').select('id, titre, type_opportunite, secteur, date_expiration').order('date_publication', { ascending: false }).limit(30),
      supabase.from('concours').select('id, titre, organisateur, date_limite_inscription').order('created_at', { ascending: false }).limit(30),
      supabase.from('bourses').select('id, titre, organisme, montant, date_limite').order('created_at', { ascending: false }).limit(30),
      supabase.from('financements').select('id, titre, organisme, montant_max').order('created_at', { ascending: false }).limit(30),
      supabase.from('metiers_porteurs').select('id, nom_metier, secteur, niveau_demande').limit(30),
      supabase.from('analyses_marche').select('id, titre, secteur, date_publication').order('date_publication', { ascending: false }).limit(30),
    ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader
        eyebrowIcon={LineChart}
        eyebrowText="Activité"
        title="Intelligence économique"
        subtitle="Opportunités, concours, bourses, financements et analyses de marché — globales ou spécifiques à une organisation."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard icon={LineChart} label="Opportunités" value={opportunites?.length ?? 0} />
        <StatCard icon={LineChart} label="Concours" value={concours?.length ?? 0} />
        <StatCard icon={LineChart} label="Bourses" value={bourses?.length ?? 0} />
        <StatCard icon={LineChart} label="Financements" value={financements?.length ?? 0} />
        <StatCard icon={LineChart} label="Métiers porteurs" value={metiers?.length ?? 0} />
        <StatCard icon={LineChart} label="Analyses de marché" value={analyses?.length ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Opportunités">
          <DataTable
            columns={['Titre', 'Type', 'Secteur', 'Expire le']}
            rows={(opportunites ?? []).map((o: any) => [o.titre, o.type_opportunite ?? '—', o.secteur ?? '—', o.date_expiration ? formatter.format(new Date(o.date_expiration)) : '—'])}
            emptyText="Aucune opportunité pour le moment."
          />
        </Panel>

        <Panel title="Concours">
          <DataTable
            columns={['Titre', 'Organisateur', 'Date limite']}
            rows={(concours ?? []).map((c: any) => [c.titre, c.organisateur ?? '—', c.date_limite_inscription ? formatter.format(new Date(c.date_limite_inscription)) : '—'])}
            emptyText="Aucun concours pour le moment."
          />
        </Panel>

        <Panel title="Bourses">
          <DataTable
            columns={['Titre', 'Organisme', 'Montant']}
            rows={(bourses ?? []).map((b: any) => [b.titre, b.organisme ?? '—', b.montant ?? '—'])}
            emptyText="Aucune bourse pour le moment."
          />
        </Panel>

        <Panel title="Financements">
          <DataTable
            columns={['Titre', 'Organisme', 'Montant max']}
            rows={(financements ?? []).map((f: any) => [f.titre, f.organisme ?? '—', f.montant_max != null ? `${f.montant_max} FCFA` : '—'])}
            emptyText="Aucun financement pour le moment."
          />
        </Panel>

        <Panel title="Métiers porteurs">
          <DataTable
            columns={['Métier', 'Secteur', 'Demande']}
            rows={(metiers ?? []).map((m: any) => [m.nom_metier, m.secteur ?? '—', m.niveau_demande ?? '—'])}
            emptyText="Aucun métier porteur référencé."
          />
        </Panel>

        <Panel title="Analyses de marché">
          <DataTable
            columns={['Titre', 'Secteur', 'Publiée le']}
            rows={(analyses ?? []).map((a: any) => [a.titre, a.secteur ?? '—', formatter.format(new Date(a.date_publication))])}
            emptyText="Aucune analyse de marché publiée."
          />
        </Panel>
      </div>
    </>
  )
}
