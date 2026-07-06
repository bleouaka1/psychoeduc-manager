import Link from 'next/link'
import { Store, Star, ShoppingBag, GraduationCap, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel } from '../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../_lib/getSoloOrg'
import { sInscrireFormation } from '../marketplace-actions'
import { sAchterOffre, creerOffre, modifierOffre, retirerOffre, supprimerOffre } from './actions'
import { FavoriToggle } from '../_components/FavoriToggle'
import { OffreForm } from '../../_components/OffreForm'
import { OffresListe } from '../../_components/OffresListe'

const VENDEUR_LABEL: Record<string, string> = { solo: 'Indépendant', structure: 'Structure', employeur: 'Entreprise' }

export default async function MarketplacePubliquePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; vendeur?: string; q?: string; edit?: string }>
}) {
  const { type = 'tout', vendeur = 'tout', q = '', edit: editId } = await searchParams
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Nettoie l'entrée libre avant de l'interpoler dans une chaîne de filtre PostgREST :
  // virgules/parenthèses/points pourraient sinon injecter des clauses de filtre supplémentaires
  // (pas une injection SQL — PostgREST/RLS restent en dessous — mais un contournement possible
  // du filtre de recherche prévu). On retire ces caractères plutôt que les échapper : recherche
  // libre uniquement, aucune perte de fonctionnalité réelle pour l'utilisateur.
  const qNettoye = q.trim().replace(/[,().]/g, ' ').slice(0, 200)

  let requete = supabase.from('vue_marketplace_publique').select('*').neq('organisation_id', organisation.id)
  if (type !== 'tout') requete = type === 'produit_service' ? requete.in('type_offre', ['produit', 'service']) : requete.eq('type_offre', type)
  if (vendeur !== 'tout') requete = requete.eq('type_organisation', vendeur)
  if (qNettoye) requete = requete.or(`titre.ilike.%${qNettoye}%,description.ilike.%${qNettoye}%`)

  const { data: offres } = await requete.order('created_at', { ascending: false }).limit(60)

  const { data: favoris } = user ? await supabase.from('favoris_marketplace').select('offre_type, offre_id').eq('profile_id', user.id) : { data: [] as any[] }
  const favorisSet = new Set((favoris ?? []).map((f: any) => `${f.offre_type}:${f.offre_id}`))

  const { data: mesOffres } = await supabase
    .from('marketplace_offres')
    .select('id, titre, type_offre, description, prix, statut, image_couverture_url, stock_disponible, modalites_livraison, duree_texte, mode_transmission')
    .eq('organisation_id', organisation.id)
    .order('created_at', { ascending: false })

  const offreEnEdition = editId ? (mesOffres ?? []).find((o: any) => o.id === editId) : null

  const onglets = [
    { valeur: 'tout', label: 'Tout' },
    { valeur: 'formation', label: 'Formations & compétences' },
    { valeur: 'produit_service', label: 'Entreprises (services & produits)' },
  ]

  return (
    <>
      <PageHeader
        eyebrowIcon={Store}
        eyebrowText="Mon espace Solo"
        title="Marketplace"
        subtitle="Découvrez les offres des autres comptes — formations, services et produits."
        actions={
          <Link href="/solo/favoris" className="flex items-center gap-1.5 bg-bg-card border border-border-soft text-text-primary text-[13px] font-medium px-4 py-2.5 rounded-full">
            Mes favoris
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {onglets.map((o) => (
          <Link
            key={o.valeur}
            href={`/solo/marketplace?type=${o.valeur}${vendeur !== 'tout' ? `&vendeur=${vendeur}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`text-[12.5px] px-3.5 py-1.5 rounded-full border ${type === o.valeur ? 'bg-accent-gold text-bg-base border-accent-gold font-semibold' : 'border-border-soft text-text-muted hover:text-text-primary'}`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      <form action="/solo/marketplace" method="get" className="flex flex-wrap gap-2.5 mb-6">
        <input type="hidden" name="type" value={type} />
        <select name="vendeur" defaultValue={vendeur} className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary">
          <option value="tout">Tous les types de vendeur</option>
          <option value="solo">Indépendants</option>
          <option value="structure">Structures</option>
          <option value="employeur">Entreprises</option>
        </select>
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher par nom ou besoin (ex. gérer mon stress)…"
          className="flex-1 min-w-[220px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
        />
        <button type="submit" className="text-[13px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-4 py-2">
          Filtrer
        </button>
      </form>

      <Panel title={`${offres?.length ?? 0} offre(s)`} className="mb-8">
        {(offres ?? []).length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">Aucune offre ne correspond à ces filtres pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(offres ?? []).map((o: any) => {
              const offreType: 'formation' | 'marketplace_offre' = o.type_offre === 'formation' ? 'formation' : 'marketplace_offre'
              const estFavori = favorisSet.has(`${offreType}:${o.id}`)
              const nouveauVendeur = o.organisation_created_at && Date.now() - new Date(o.organisation_created_at).getTime() < 30 * 24 * 60 * 60 * 1000
              return (
                <div key={`${offreType}-${o.id}`} className="bg-bg-surface border border-border-soft rounded-xl overflow-hidden flex flex-col">
                  <div className="h-32 bg-bg-card flex items-center justify-center">
                    {o.image_couverture_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.image_couverture_url} alt={o.titre} className="w-full h-full object-cover" />
                    ) : o.type_offre === 'formation' ? (
                      <GraduationCap size={28} className="text-text-muted" />
                    ) : o.type_offre === 'produit' ? (
                      <Package size={28} className="text-text-muted" />
                    ) : (
                      <ShoppingBag size={28} className="text-text-muted" />
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-1.5 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-[14.5px] text-text-primary">{o.titre}</p>
                      <FavoriToggle offreType={offreType} offreId={o.id} actif={estFavori} />
                    </div>
                    <p className="text-text-muted text-[11px] flex items-center gap-1.5 flex-wrap">
                      Par {o.organisation_nom}
                      <span className="bg-bg-card border border-border-soft px-1.5 py-0.5 rounded-full text-[9.5px]">{VENDEUR_LABEL[o.type_organisation] ?? o.type_organisation}</span>
                      {o.vendeur_est_fondateur && (
                        <span className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[9px] font-bold px-1.5 py-0.5 rounded-full">FONDATEUR</span>
                      )}
                      {nouveauVendeur && (
                        <span className="bg-accent-teal-dim text-[#bff2ec] text-[9px] font-bold px-1.5 py-0.5 rounded-full">NOUVEAU VENDEUR</span>
                      )}
                    </p>
                    {o.description && <p className="text-text-muted text-xs line-clamp-2">{o.description}</p>}
                    <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1">
                      {o.nombre_avis > 0 && (
                        <span className="flex items-center gap-0.5 text-accent-gold">
                          <Star size={11} /> {o.note_moyenne}/5 ({o.nombre_avis})
                        </span>
                      )}
                      {o.nombre_achats > 0 && <span>{o.nombre_achats} vente(s)</span>}
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <span className="font-data text-accent-gold text-sm font-semibold">{o.prix != null ? `${o.prix} ${o.devise}` : '—'}</span>
                      {o.type_offre === 'formation' ? (
                        <form action={sInscrireFormation.bind(null, o.id)}>
                          <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[12px] font-semibold px-3.5 py-1.5 rounded-full">
                            Je m'inscris
                          </button>
                        </form>
                      ) : (
                        <form action={sAchterOffre.bind(null, o.id, o.prix ?? 0, o.organisation_id)}>
                          <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[12px] font-semibold px-3.5 py-1.5 rounded-full">
                            Acheter
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title={offreEnEdition ? `Modifier « ${offreEnEdition.titre} »` : 'Publier une offre (produit ou service)'} className="mb-6">
        <OffreForm action={offreEnEdition ? modifierOffre.bind(null, offreEnEdition.id) : creerOffre} offre={offreEnEdition ?? undefined} hrefAnnuler="/solo/marketplace" />
        <p className="text-text-muted text-[11.5px] mt-3">
          Toute nouvelle offre passe par une validation du Fondateur avant publication (protection contre les annonces frauduleuses), et nécessite une image de couverture.
        </p>
      </Panel>

      <Panel title="Mes offres (produit/service)">
        <OffresListe offres={mesOffres ?? []} editHrefBase="/solo/marketplace" retirerAction={retirerOffre} supprimerAction={supprimerOffre} />
      </Panel>
    </>
  )
}
