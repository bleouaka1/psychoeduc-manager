import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { sInscrireFormation } from '@/app/solo/marketplace-actions'
import { sAchterOffre } from '@/app/solo/marketplace/actions'

const VENDEUR_LABEL: Record<string, string> = { solo: 'Indépendant', structure: 'Structure', employeur: 'Entreprise' }

export default async function MarketplaceBeneficiairePage({
  params,
  searchParams,
}: {
  params: Promise<{ beneficiaireId: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const { beneficiaireId } = await params
  const { type = 'tout' } = await searchParams
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  if (!dossiers.find((d) => d.id === beneficiaireId)) notFound()

  let requete = supabase.from('vue_marketplace_publique').select('*')
  if (type !== 'tout') requete = type === 'produit_service' ? requete.in('type_offre', ['produit', 'service']) : requete.eq('type_offre', type)
  const { data: offres } = await requete.order('created_at', { ascending: false }).limit(60)

  const onglets = [
    { valeur: 'tout', label: 'Tout' },
    { valeur: 'formation', label: 'Formations & compétences' },
    { valeur: 'produit_service', label: 'Entreprises (services & produits)' },
  ]

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Explorer</p>
      <h1 className="font-cinzel font-semibold text-3xl text-text-primary mb-1">Marketplace</h1>
      <p className="text-text-muted text-sm mb-7">Découvre des formations, services et produits proposés par la communauté.</p>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {onglets.map((o) => (
          <Link
            key={o.valeur}
            href={`/mon-espace/${beneficiaireId}/marketplace?type=${o.valeur}`}
            className={`text-[12.5px] px-3.5 py-1.5 rounded-full border ${
              type === o.valeur ? 'bg-accent-gold text-bg-base border-accent-gold font-semibold' : 'border-border-soft text-text-muted hover:text-text-primary'
            }`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      {(offres ?? []).length === 0 ? (
        <p className="text-text-muted text-sm py-10 text-center">Aucune offre disponible pour le moment.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(offres ?? []).map((o: any) => (
            <div key={`${o.type_offre}-${o.id}`} className="bg-bg-card border border-border-soft rounded-[10px] overflow-hidden flex flex-col">
              <div className="h-28 bg-bg-surface flex items-center justify-center">
                {o.image_couverture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.image_couverture_url} alt={o.titre} className="w-full h-full object-cover" />
                ) : (
                  <Store size={22} className="text-text-muted" />
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <p className="text-text-primary text-[14px] font-medium mb-1">{o.titre}</p>
                <p className="text-text-muted text-[11.5px] mb-3">
                  {o.organisation_nom} ({VENDEUR_LABEL[o.type_organisation] ?? o.type_organisation})
                </p>
                <p className="font-data text-accent-gold text-[15px] mt-auto mb-3">{o.prix != null ? `${o.prix} ${o.devise}` : 'Gratuit'}</p>
                <form action={o.type_offre === 'formation' ? sInscrireFormation.bind(null, o.id) : sAchterOffre.bind(null, o.id, o.prix ?? 0, o.organisation_id)}>
                  <button type="submit" className="w-full text-[13px] font-semibold text-bg-base bg-accent-gold rounded-full px-4 py-2">
                    {o.type_offre === 'formation' ? 'Je me lance' : 'Acquérir cette offre'}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
