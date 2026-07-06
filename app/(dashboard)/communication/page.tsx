import { MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill } from '../_components/ui'

export default async function CommunicationPage() {
  const supabase = await createClient()
  const [{ data: messages }, { data: campagnes }] = await Promise.all([
    supabase
      .from('messages')
      .select('id, contenu, canal, statut, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('campagnes_messages')
      .select('id, nom, canal, statut, date_lancement, organisations(nom)')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <PageHeader eyebrowIcon={MessageCircle} eyebrowText="Activité" title="Communication" subtitle="Messages internes, campagnes et rappels WhatsApp." />
      <div className="space-y-6">
        <Panel title={`${campagnes?.length ?? 0} campagne(s)`}>
          <DataTable
            columns={['Nom', 'Organisation', 'Canal', 'Statut', 'Lancement']}
            rows={(campagnes ?? []).map((c: any) => [
              c.nom,
              c.organisations?.nom ?? '—',
              c.canal ?? '—',
              <StatusPill key="s" status={c.statut === 'en_cours' ? 'ok' : c.statut === 'terminee' ? 'idle' : 'warn'}>{c.statut}</StatusPill>,
              c.date_lancement ? formatter.format(new Date(c.date_lancement)) : '—',
            ])}
            emptyText="Aucune campagne pour le moment."
          />
        </Panel>

        <Panel title={`${messages?.length ?? 0} message(s) récents`}>
          <DataTable
            columns={['Contenu', 'Canal', 'Statut', 'Date']}
            rows={(messages ?? []).map((m: any) => [
              (m.contenu ?? '').slice(0, 80),
              m.canal ?? '—',
              m.statut,
              formatter.format(new Date(m.created_at)),
            ])}
            emptyText="Aucun message pour le moment."
          />
        </Panel>
      </div>
    </>
  )
}
