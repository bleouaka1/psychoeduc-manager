import { Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill } from '../_components/ui'
import { supprimerBeneficiaireFondateur } from './actions'
import { SupprimerAvecConfirmation } from '../../solo/_components/ConfirmModal'

export default async function BeneficiairesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('beneficiaires')
    .select('id, nom, prenoms, statut_beneficiaire, created_at, organisations(nom)')
    .order('created_at', { ascending: false })
    .limit(100)

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={Users} eyebrowText="Parcours" title="Bénéficiaires" subtitle="Personnes suivies, tous types d’organisations confondus." />
      <Panel title={`${data?.length ?? 0} bénéficiaire(s) — 100 plus récents`}>
        <DataTable
          columns={['Nom', 'Prénoms', 'Organisation', 'Statut', 'Ajouté le', 'Actions']}
          rows={(data ?? []).map((b: any) => [
            b.nom,
            b.prenoms,
            b.organisations?.nom ?? '—',
            <StatusPill key="s" status={b.statut_beneficiaire === 'actif' ? 'ok' : 'idle'}>{b.statut_beneficiaire}</StatusPill>,
            formatter.format(new Date(b.created_at)),
            <SupprimerAvecConfirmation
              key="actions"
              action={supprimerBeneficiaireFondateur.bind(null, b.id)}
              titreConfirmation="Supprimer ce bénéficiaire ?"
              messageConfirmation={`« ${b.prenoms} ${b.nom} » sera définitivement supprimé(e). Cette action est irréversible.`}
            />,
          ])}
          emptyText="Aucun bénéficiaire pour le moment."
        />
      </Panel>
    </>
  )
}
