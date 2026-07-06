import { Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard, StatusPill } from '../_components/ui'

const STATUT_STYLE: Record<string, 'ok' | 'warn' | 'down' | 'idle'> = {
  publiee: 'ok',
  en_attente_validation: 'warn',
  refusee: 'down',
  masquee: 'down',
  retiree: 'idle',
}

export default async function MarketplacePage() {
  const supabase = await createClient()
  const [{ data: offres }, { data: signalements }, { data: vue }] = await Promise.all([
    supabase.from('marketplace_offres').select('id, titre, type_offre, prix, statut, nombre_signalements, organisations(nom)').order('created_at', { ascending: false }).limit(50),
    supabase.from('marketplace_signalements').select('id, motif, statut, created_at, marketplace_offres(titre)').order('created_at', { ascending: false }).limit(30),
    supabase.from('vue_marketplace').select('*').single(),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={Store} eyebrowText="Activité" title="Marketplace" subtitle="Offres de formations, services et produits — validation Fondateur obligatoire avant publication." />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-8">
        <StatCard icon={Store} label="Offres publiées" value={vue?.offres_publiees ?? 0} />
        <StatCard icon={Store} label="En attente de validation" value={vue?.offres_en_attente ?? 0} />
        <StatCard icon={Store} label="Masquées (signalements)" value={vue?.offres_masquees ?? 0} />
        <StatCard icon={Store} label="Commission confirmée" value={`${vue?.commission_totale_confirmee ?? 0} FCFA`} />
      </div>

      <div className="space-y-6">
        <Panel title={`${offres?.length ?? 0} offre(s)`}>
          <DataTable
            columns={['Titre', 'Type', 'Vendeur', 'Prix', 'Statut', 'Signalements']}
            rows={(offres ?? []).map((o: any) => [
              o.titre,
              o.type_offre ?? '—',
              o.organisations?.nom ?? 'Solo',
              o.prix != null ? `${o.prix} FCFA` : '—',
              <StatusPill key="s" status={STATUT_STYLE[o.statut] ?? 'idle'}>{o.statut}</StatusPill>,
              o.nombre_signalements,
            ])}
            emptyText="Aucune offre marketplace pour le moment."
          />
        </Panel>

        <Panel title="Signalements récents">
          <DataTable
            columns={['Offre', 'Motif', 'Statut', 'Date']}
            rows={(signalements ?? []).map((s: any) => [s.marketplace_offres?.titre ?? '—', s.motif ?? '—', s.statut, formatter.format(new Date(s.created_at))])}
            emptyText="Aucun signalement pour le moment."
          />
        </Panel>
      </div>
    </>
  )
}
