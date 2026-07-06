import { Landmark, Wallet, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard } from '../_components/ui'

export default async function FinancesPage() {
  const supabase = await createClient()
  const [{ data: revenus }, { data: paiements }, { data: solde }] = await Promise.all([
    supabase.from('vue_revenus').select('*'),
    supabase
      .from('paiements')
      .select('id, montant, devise, statut, methode_paiement, created_at, organisations(nom)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('wallet_fondateur').select('*').single(),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const totalConfirme = (revenus ?? []).reduce((acc: number, r: any) => acc + Number(r.total_confirme ?? 0), 0)

  return (
    <>
      <PageHeader eyebrowIcon={Landmark} eyebrowText="Activité" title="Finances" subtitle="Revenus, paiements et portefeuille de la plateforme." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <StatCard icon={Wallet} label="Revenus confirmés (total)" value={`${totalConfirme} FCFA`} />
        <StatCard icon={Landmark} label="Solde portefeuille fondateur" value={`${solde?.solde ?? 0} FCFA`} />
        <StatCard icon={Receipt} label="Paiements récents" value={paiements?.length ?? 0} />
      </div>

      <div className="space-y-6">
        <Panel title="Revenus confirmés par mois">
          <DataTable
            columns={['Mois', 'Total confirmé']}
            rows={(revenus ?? []).map((r: any) => [
              new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(r.mois)),
              `${r.total_confirme} FCFA`,
            ])}
            emptyText="Aucun revenu confirmé pour le moment."
          />
        </Panel>

        <Panel title="Derniers paiements">
          <DataTable
            columns={['Organisation', 'Montant', 'Méthode', 'Statut', 'Date']}
            rows={(paiements ?? []).map((p: any) => [
              p.organisations?.nom ?? '—',
              `${p.montant} ${p.devise}`,
              p.methode_paiement ?? '—',
              p.statut,
              formatter.format(new Date(p.created_at)),
            ])}
            emptyText="Aucun paiement pour le moment."
          />
        </Panel>
      </div>
    </>
  )
}
