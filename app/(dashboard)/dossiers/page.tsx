import Link from 'next/link'
import { FolderCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, EmptyState, DataTable, StatusPill } from '../_components/ui'
import { getMonOrganisation } from '../_lib/getMonOrganisation'

export default async function DossiersPage() {
  const organisation = await getMonOrganisation()
  if (!organisation) {
    return (
      <>
        <PageHeader eyebrowIcon={FolderCheck} eyebrowText="Gestion Administrative" title="Dossiers" />
        <Panel>
          <EmptyState text="Aucune organisation Structure rattachée à ce compte." />
        </Panel>
      </>
    )
  }

  const supabase = await createClient()

  const { data: org } = await supabase.from('organisations').select('module_admin_actif').eq('id', organisation.id).single()
  if (!org?.module_admin_actif) {
    return (
      <>
        <PageHeader eyebrowIcon={FolderCheck} eyebrowText="Gestion Administrative" title="Dossiers" />
        <Panel>
          <EmptyState text="Le module Gestion Administrative n'est pas activé pour cette organisation. Un Directeur ou Promoteur peut l'activer depuis Paramètres organisation." />
        </Panel>
      </>
    )
  }

  const [{ data: beneficiaires }, { data: pieces }] = await Promise.all([
    supabase.from('beneficiaires').select('id, nom, prenoms').eq('organisation_id', organisation.id).order('nom'),
    supabase.from('documents_beneficiaires').select('beneficiaire_id, statut').eq('organisation_id', organisation.id),
  ])

  const parBeneficiaire = new Map<string, { total: number; valide: number; recu: number; manquant: number }>()
  for (const p of pieces ?? []) {
    const c = parBeneficiaire.get(p.beneficiaire_id) ?? { total: 0, valide: 0, recu: 0, manquant: 0 }
    c.total += 1
    if (p.statut === 'valide') c.valide += 1
    else if (p.statut === 'recu') c.recu += 1
    else c.manquant += 1
    parBeneficiaire.set(p.beneficiaire_id, c)
  }

  return (
    <>
      <PageHeader eyebrowIcon={FolderCheck} eyebrowText="Gestion Administrative" title="Dossiers" subtitle="Checklist des pièces administratives par bénéficiaire." />

      <Panel title={`${beneficiaires?.length ?? 0} bénéficiaire(s)`}>
        {!beneficiaires || beneficiaires.length === 0 ? (
          <EmptyState text="Aucun bénéficiaire dans cette organisation." />
        ) : (
          <DataTable
            columns={['Nom', 'Prénoms', 'Pièces', 'Statut']}
            rows={beneficiaires.map((b: any) => {
              const c = parBeneficiaire.get(b.id) ?? { total: 0, valide: 0, recu: 0, manquant: 0 }
              const complet = c.total > 0 && c.valide === c.total
              return [
                <Link key="nom" href={`/dossiers/${b.id}`} className="text-accent-gold hover:underline">
                  {b.nom}
                </Link>,
                b.prenoms,
                c.total === 0 ? 'Aucune pièce déclarée' : `${c.valide}/${c.total} validée(s)`,
                <StatusPill key="s" status={complet ? 'ok' : c.total === 0 ? 'idle' : 'warn'}>
                  {complet ? 'Complet' : c.total === 0 ? 'Non démarré' : 'En cours'}
                </StatusPill>,
              ]
            })}
            emptyText="Aucun bénéficiaire."
          />
        )}
      </Panel>
    </>
  )
}
