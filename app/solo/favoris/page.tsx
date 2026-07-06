import { Heart, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel } from '../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../_lib/getSoloOrg'
import { FavoriToggle } from '../_components/FavoriToggle'

export default async function FavorisPage() {
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: favoris } = await supabase.from('favoris_marketplace').select('offre_type, offre_id').eq('profile_id', user.id)

  const idsFormations = (favoris ?? []).filter((f: any) => f.offre_type === 'formation').map((f: any) => f.offre_id)
  const idsOffres = (favoris ?? []).filter((f: any) => f.offre_type === 'marketplace_offre').map((f: any) => f.offre_id)

  const { data: offres } =
    idsFormations.length + idsOffres.length > 0
      ? await supabase.from('vue_marketplace_publique').select('*').or(`id.in.(${[...idsFormations, ...idsOffres].join(',') || '00000000-0000-0000-0000-000000000000'})`)
      : { data: [] as any[] }

  return (
    <>
      <PageHeader eyebrowIcon={Heart} eyebrowText="Mon espace Solo" title="Mes favoris" subtitle="Les offres que vous avez mises de côté sur la marketplace." />

      <Panel title={`${offres?.length ?? 0} favori(s)`}>
        {(offres ?? []).length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">Aucun favori pour le moment — parcourez la Marketplace pour en ajouter.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(offres ?? []).map((o: any) => (
              <div key={o.id} className="bg-bg-surface border border-border-soft rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-[14.5px] text-text-primary">{o.titre}</p>
                  <FavoriToggle offreType={o.type_offre === 'formation' ? 'formation' : 'marketplace_offre'} offreId={o.id} actif />
                </div>
                <p className="text-text-muted text-[11px] mt-0.5">Par {o.organisation_nom}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-data text-accent-gold text-sm">{o.prix != null ? `${o.prix} ${o.devise}` : '—'}</span>
                  {o.nombre_avis > 0 && (
                    <span className="flex items-center gap-0.5 text-[11px] text-accent-gold">
                      <Star size={11} /> {o.note_moyenne}/5
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  )
}
