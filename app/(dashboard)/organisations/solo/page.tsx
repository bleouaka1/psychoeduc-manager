import { User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable } from '../../_components/ui'

export default async function ComptesSoloPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organisations')
    .select('id, nom, pays, ville, created_at')
    .eq('type_organisation', 'solo')
    .order('created_at', { ascending: false })

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={User} eyebrowText="Clients" title="Comptes Solo" subtitle="Formateurs, coachs et consultants inscrits en nom propre." />
      <Panel title={`${data?.length ?? 0} compte(s) Solo`}>
        <DataTable
          columns={['Nom', 'Pays', 'Ville', 'Inscrit le']}
          rows={(data ?? []).map((o) => [o.nom, o.pays ?? '—', o.ville ?? '—', formatter.format(new Date(o.created_at))])}
          emptyText="Aucun compte Solo pour le moment."
        />
      </Panel>
    </>
  )
}
