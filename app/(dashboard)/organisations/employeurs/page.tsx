import { Briefcase } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable } from '../../_components/ui'

export default async function EmployeursPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organisations')
    .select('id, nom, pays, ville, created_at')
    .in('type_organisation', ['employeur', 'entreprise'])
    .order('created_at', { ascending: false })

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={Briefcase} eyebrowText="Clients" title="Employeurs" subtitle="Entreprises partenaires de recrutement et d’insertion." />
      <Panel title={`${data?.length ?? 0} employeur(s)`}>
        <DataTable
          columns={['Nom', 'Pays', 'Ville', 'Inscrit le']}
          rows={(data ?? []).map((o) => [o.nom, o.pays ?? '—', o.ville ?? '—', formatter.format(new Date(o.created_at))])}
          emptyText="Aucun employeur pour le moment."
        />
      </Panel>
    </>
  )
}
