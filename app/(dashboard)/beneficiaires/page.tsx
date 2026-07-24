import Link from 'next/link'
import { Users, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill } from '../_components/ui'
import { supprimerBeneficiaireFondateur, ajouterBeneficiaireStructure } from './actions'
import { SupprimerAvecConfirmation } from '../../solo/_components/ConfirmModal'
import { getMonOrganisation } from '../_lib/getMonOrganisation'

export default async function BeneficiairesPage() {
  const supabase = await createClient()
  const [{ data }, organisation] = await Promise.all([
    supabase.from('beneficiaires').select('id, nom, prenoms, statut_beneficiaire, created_at, organisations(nom)').order('created_at', { ascending: false }).limit(100),
    getMonOrganisation(),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const peutCreer = organisation?.roles.some((r) => ['directeur', 'coordinateur', 'educateur', 'promoteur', 'administrateur'].includes(r))

  return (
    <>
      <PageHeader eyebrowIcon={Users} eyebrowText="Parcours" title="Bénéficiaires" subtitle="Personnes suivies, tous types d’organisations confondus." />

      {peutCreer && (
        <Panel title="Ajouter un bénéficiaire" icon={UserPlus} className="mb-6">
          <form action={ajouterBeneficiaireStructure} className="flex flex-wrap items-center gap-2.5">
            <input name="nom" required placeholder="Nom" className="flex-1 min-w-[160px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary" />
            <input name="prenoms" required placeholder="Prénoms" className="flex-1 min-w-[160px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary" />
            <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
              Ajouter
            </button>
          </form>
        </Panel>
      )}

      <Panel title={`${data?.length ?? 0} bénéficiaire(s) — 100 plus récents`}>
        <DataTable
          columns={['Nom', 'Prénoms', 'Organisation', 'Statut', 'Ajouté le', 'Actions']}
          rows={(data ?? []).map((b: any) => [
            <Link key="nom" href={`/beneficiaires/${b.id}`} className="text-accent-gold hover:underline">
              {b.nom}
            </Link>,
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
