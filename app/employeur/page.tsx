import { Store, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatCard, DataTable } from '../(dashboard)/_components/ui'
import { getEmployeurOrganisation } from './_lib/getEmployeurOrg'
import { creerOffreEmployeur, modifierOffreEmployeur, retirerOffreEmployeur, supprimerOffreEmployeur } from './actions'
import { OffreForm } from '../_components/OffreForm'
import { OffresListe } from '../_components/OffresListe'

export default async function EmployeurPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit: editId } = await searchParams
  const organisation = await getEmployeurOrganisation()
  if (!organisation) return null

  const supabase = await createClient()

  const { data: offres } = await supabase
    .from('marketplace_offres')
    .select('id, titre, type_offre, description, prix, statut, image_couverture_url, stock_disponible, modalites_livraison, duree_texte, mode_transmission')
    .eq('organisation_id', organisation.id)
    .order('created_at', { ascending: false })

  const offreIds = (offres ?? []).map((o: any) => o.id)
  const { data: commandes } =
    offreIds.length > 0
      ? await supabase
          .from('marketplace_commandes')
          .select('id, montant_brut, montant_vendeur, statut_paiement, created_at, marketplace_offres(titre)')
          .in('offre_id', offreIds)
          .order('created_at', { ascending: false })
          .limit(30)
      : { data: [] as any[] }

  const revenuConfirme = (commandes ?? []).filter((c: any) => c.statut_paiement === 'confirme').reduce((a: number, c: any) => a + Number(c.montant_vendeur ?? c.montant_brut ?? 0), 0)
  const offreEnEdition = editId ? (offres ?? []).find((o: any) => o.id === editId) : null
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={Store} eyebrowText="Mon espace Employeur" title="Mes offres" subtitle="Publiez vos formations courtes et services sur la Marketplace." />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <StatCard icon={Store} label="Offres publiées" value={(offres ?? []).filter((o: any) => o.statut === 'publiee').length} hint={`${offres?.length ?? 0} au total`} />
        <StatCard icon={Wallet} label="Revenus confirmés" value={`${revenuConfirme} FCFA`} />
      </div>

      <Panel title={offreEnEdition ? `Modifier « ${offreEnEdition.titre} »` : 'Publier une offre'} className="mb-6">
        <OffreForm action={offreEnEdition ? modifierOffreEmployeur.bind(null, offreEnEdition.id) : creerOffreEmployeur} offre={offreEnEdition ?? undefined} hrefAnnuler="/employeur" />
        <p className="text-text-muted text-[11.5px] mt-3">
          Toute nouvelle offre passe par une validation du Fondateur avant publication, et nécessite une image de couverture. Une formation courte se déclare en type « Service » avec sa durée et son mode de transmission.
        </p>
      </Panel>

      <Panel title="Mes offres" className="mb-6">
        <OffresListe offres={offres ?? []} editHrefBase="/employeur" retirerAction={retirerOffreEmployeur} supprimerAction={supprimerOffreEmployeur} />
      </Panel>

      <Panel title="Commandes reçues">
        <DataTable
          columns={['Offre', 'Montant', 'Statut', 'Date']}
          rows={(commandes ?? []).map((c: any) => [c.marketplace_offres?.titre ?? '—', `${c.montant_brut} FCFA`, c.statut_paiement, formatter.format(new Date(c.created_at))])}
          emptyText="Aucune commande reçue pour le moment."
        />
      </Panel>
    </>
  )
}
