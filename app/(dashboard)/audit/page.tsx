import { ScrollText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill } from '../_components/ui'

export default async function AuditPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('audit_logs')
    .select('id, action, table_cible, ligne_id, created_at, profiles(email), organisations(nom)')
    .order('created_at', { ascending: false })
    .limit(100)

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <>
      <PageHeader eyebrowIcon={ScrollText} eyebrowText="Gouvernance" title="Journal d’audit" subtitle="Traçabilité complète, append-only, jamais modifiable." />
      <Panel title={`${data?.length ?? 0} entrée(s) — 100 plus récentes`}>
        <DataTable
          columns={['Action', 'Table', 'Organisation', 'Auteur', 'Horodatage']}
          rows={(data ?? []).map((a: any) => [
            <StatusPill key="s" status={a.action === 'DELETE' ? 'down' : a.action === 'INSERT' ? 'ok' : 'warn'}>{a.action}</StatusPill>,
            a.table_cible,
            a.organisations?.nom ?? '—',
            a.profiles?.email ?? 'système',
            formatter.format(new Date(a.created_at)),
          ])}
          emptyText="Aucune entrée d’audit pour le moment."
        />
      </Panel>
    </>
  )
}
