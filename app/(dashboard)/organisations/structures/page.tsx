import { Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable } from '../../_components/ui'

const TYPES_STRUCTURES = ['structure', 'centre', 'ong', 'ecole', 'association', 'fondation']

export default async function StructuresPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organisations')
    .select('id, nom, type_organisation, pays, ville, created_at')
    .in('type_organisation', TYPES_STRUCTURES)
    .order('created_at', { ascending: false })

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={Building2} eyebrowText="Clients" title="Structures" subtitle="Écoles, ONG, centres, associations et fondations." />
      <Panel title={`${data?.length ?? 0} structure(s)`}>
        <DataTable
          columns={['Nom', 'Type', 'Pays', 'Ville', 'Inscrite le']}
          rows={(data ?? []).map((o) => [o.nom, o.type_organisation, o.pays ?? '—', o.ville ?? '—', formatter.format(new Date(o.created_at))])}
          emptyText="Aucune structure pour le moment."
        />
      </Panel>
    </>
  )
}
