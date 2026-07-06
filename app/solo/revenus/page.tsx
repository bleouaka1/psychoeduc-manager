import { Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard } from '../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../_lib/getSoloOrg'

export default async function SoloRevenusPage() {
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()
  const { data: paiements } = await supabase
    .from('paiements_formation')
    .select('id, montant, devise, statut, created_at, inscriptions_formations!inner(organisation_id, formations(titre))')
    .eq('inscriptions_formations.organisation_id', organisation.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const totalConfirme = (paiements ?? []).filter((p: any) => p.statut === 'confirme').reduce((a: number, p: any) => a + Number(p.montant ?? 0), 0)
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={Wallet} eyebrowText="Mon espace Solo" title="Revenus" subtitle="Vue consolidée de vos ventes de formations. Alimente les Finances globales du Cockpit Fondateur." />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <StatCard icon={Wallet} label="Revenus confirmés (formations)" value={`${totalConfirme} FCFA`} />
        <StatCard icon={Wallet} label="Transactions enregistrées" value={paiements?.length ?? 0} />
      </div>

      <Panel title="Historique des paiements (formations)" className="mb-6">
        <DataTable
          columns={['Formation', 'Montant', 'Statut', 'Date']}
          rows={(paiements ?? []).map((p: any) => [p.inscriptions_formations?.formations?.titre ?? '—', `${p.montant} ${p.devise}`, p.statut, formatter.format(new Date(p.created_at))])}
          emptyText="Aucun paiement enregistré pour le moment."
        />
      </Panel>

      <Panel title="À savoir">
        <p className="text-text-muted text-[13px] leading-relaxed">
          La facturation par bénéficiaire (suivi/séances) n’est pas encore construite — seules les ventes de formations sont
          consolidées ici pour le moment. Aucun prestataire de paiement n’est encore intégré dans l’application : les
          montants « confirmés » affichés ci-dessus nécessitent une confirmation manuelle en base tant que le paiement en
          ligne n’est pas branché.
        </p>
      </Panel>
    </>
  )
}
