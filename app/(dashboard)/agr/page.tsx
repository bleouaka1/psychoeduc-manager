import { TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard, StatusPill } from '../_components/ui'

export default async function AgrPage() {
  const supabase = await createClient()
  const [{ data: activites }, { data: revenus }, { data: charges }] = await Promise.all([
    supabase
      .from('activites_agr')
      .select('id, nom_activite, secteur, statut, date_debut, beneficiaires(nom, prenoms)')
      .order('date_debut', { ascending: false })
      .limit(50),
    supabase.from('revenus_agr').select('montant'),
    supabase.from('charges_agr').select('montant'),
  ])

  const totalRevenus = (revenus ?? []).reduce((acc: number, r: any) => acc + Number(r.montant ?? 0), 0)
  const totalCharges = (charges ?? []).reduce((acc: number, c: any) => acc + Number(c.montant ?? 0), 0)
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader
        eyebrowIcon={TrendingUp}
        eyebrowText="Parcours"
        title="AGR — Activités Génératrices de Revenus"
        subtitle="Activités économiques des bénéficiaires, distinctes de l’IGA."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <StatCard icon={TrendingUp} label="Activités suivies" value={activites?.length ?? 0} />
        <StatCard icon={TrendingUp} label="Revenus cumulés" value={`${totalRevenus} FCFA`} hint="Registre append-only" />
        <StatCard icon={TrendingUp} label="Charges cumulées" value={`${totalCharges} FCFA`} hint="Registre append-only" />
      </div>

      <Panel title="Activités génératrices de revenus">
        <DataTable
          columns={['Bénéficiaire', 'Activité', 'Secteur', 'Statut', 'Début']}
          rows={(activites ?? []).map((a: any) => [
            a.beneficiaires ? `${a.beneficiaires.nom} ${a.beneficiaires.prenoms}` : '—',
            a.nom_activite,
            a.secteur ?? '—',
            <StatusPill key="s" status={a.statut === 'en_cours' ? 'ok' : a.statut === 'suspendue' ? 'warn' : 'idle'}>{a.statut}</StatusPill>,
            formatter.format(new Date(a.date_debut)),
          ])}
          emptyText="Aucune activité génératrice de revenus enregistrée."
        />
      </Panel>
    </>
  )
}
