import { CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill } from '../_components/ui'

const STATUT_PILL: Record<string, 'ok' | 'warn' | 'down' | 'idle'> = {
  actif: 'ok',
  essai_gratuit: 'warn',
  expire: 'down',
  suspendu: 'down',
  archive: 'idle',
}

export default async function LicencesPage() {
  const supabase = await createClient()
  const [{ data: licences }, { data: abonnements }] = await Promise.all([
    supabase
      .from('licences')
      .select('id, type_licence, statut, date_debut, date_fin, organisations(nom)')
      .order('date_debut', { ascending: false })
      .limit(100),
    supabase
      .from('abonnements')
      .select('id, periode, montant, devise, statut, organisations(nom)')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={CreditCard} eyebrowText="Activité" title="Licences & Abonnements" subtitle="État commercial de toutes les organisations." />
      <div className="space-y-6">
        <Panel title={`${licences?.length ?? 0} licence(s)`}>
          <DataTable
            columns={['Organisation', 'Type', 'Statut', 'Début', 'Fin']}
            rows={(licences ?? []).map((l: any) => [
              l.organisations?.nom ?? '—',
              l.type_licence,
              <StatusPill key="s" status={STATUT_PILL[l.statut] ?? 'idle'}>{l.statut}</StatusPill>,
              formatter.format(new Date(l.date_debut)),
              l.date_fin ? formatter.format(new Date(l.date_fin)) : '—',
            ])}
            emptyText="Aucune licence pour le moment."
          />
        </Panel>

        <Panel title={`${abonnements?.length ?? 0} abonnement(s) récents`}>
          <DataTable
            columns={['Organisation', 'Période', 'Montant', 'Statut']}
            rows={(abonnements ?? []).map((a: any) => [
              a.organisations?.nom ?? '—',
              a.periode,
              `${a.montant} ${a.devise}`,
              <StatusPill key="s" status={a.statut === 'actif' ? 'ok' : 'idle'}>{a.statut}</StatusPill>,
            ])}
            emptyText="Aucun abonnement pour le moment."
          />
        </Panel>
      </div>
    </>
  )
}
