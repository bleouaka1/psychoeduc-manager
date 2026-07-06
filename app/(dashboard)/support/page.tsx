import { LifeBuoy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill } from '../_components/ui'

const PRIORITE_STATUS: Record<string, 'ok' | 'warn' | 'down' | 'idle'> = {
  basse: 'idle',
  normale: 'ok',
  haute: 'warn',
  urgente: 'down',
}

export default async function SupportPage() {
  const supabase = await createClient()
  const [{ data: tickets }, { data: faq }] = await Promise.all([
    supabase
      .from('tickets_support')
      .select('id, sujet, categorie, priorite, statut, created_at, profiles(email)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('faq').select('id, question, categorie').eq('actif', true).order('ordre').limit(20),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={LifeBuoy} eyebrowText="Gouvernance" title="Support" subtitle="Tickets, FAQ et ressources d’aide de la plateforme." />
      <div className="space-y-6">
        <Panel title={`${tickets?.length ?? 0} ticket(s)`}>
          <DataTable
            columns={['Sujet', 'Auteur', 'Priorité', 'Statut', 'Ouvert le']}
            rows={(tickets ?? []).map((t: any) => [
              t.sujet,
              t.profiles?.email ?? '—',
              <StatusPill key="p" status={PRIORITE_STATUS[t.priorite] ?? 'idle'}>{t.priorite}</StatusPill>,
              t.statut,
              formatter.format(new Date(t.created_at)),
            ])}
            emptyText="Aucun ticket pour le moment."
          />
        </Panel>

        <Panel title={`${faq?.length ?? 0} question(s) fréquente(s)`}>
          <DataTable
            columns={['Question', 'Catégorie']}
            rows={(faq ?? []).map((f: any) => [f.question, f.categorie ?? '—'])}
            emptyText="Aucune FAQ publiée pour le moment."
          />
        </Panel>
      </div>
    </>
  )
}
