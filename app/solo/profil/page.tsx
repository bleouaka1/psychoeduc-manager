import { IdCard, Star, Users, CalendarClock, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatCard } from '../../(dashboard)/_components/ui'
import { getSoloOrganisation, getIsFondateur } from '../_lib/getSoloOrg'
import { mettreAJourProfilPublic } from '../profil-actions'

export default async function SoloProfilPage() {
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const isFondateur = await getIsFondateur()
  const supabase = await createClient()

  const [{ data: formationsPubliees }, { data: profilPublic }, { data: organisationInfo }, { data: satisfaction }] = await Promise.all([
    supabase.from('formations').select('id, titre, prix, devise, duree_texte, mode_transmission').eq('organisation_id', organisation.id).eq('statut', 'publiee'),
    supabase.from('profils_publics_formateurs').select('bio, specialites').eq('organisation_id', organisation.id).maybeSingle(),
    supabase.from('organisations').select('created_at').eq('id', organisation.id).single(),
    // Agrège les avis des formations ET des offres produit/service — un vendeur qui ne
    // vend que des offres marketplace ne doit pas apparaître "sans note" par oubli.
    supabase.from('vue_satisfaction_vendeur').select('note_moyenne, nombre_avis').eq('organisation_id', organisation.id).maybeSingle(),
  ])

  const [{ count: beneficiairesAccompagnes }, { data: offresOrg }] = await Promise.all([
    supabase.from('beneficiaires').select('id', { count: 'exact', head: true }).eq('organisation_id', organisation.id),
    supabase.from('marketplace_offres').select('id').eq('organisation_id', organisation.id),
  ])

  const formationIds = (formationsPubliees ?? []).map((f: any) => f.id)
  const offreIds = (offresOrg ?? []).map((o: any) => o.id)
  const [{ data: acheteursFormations }, { data: acheteursOffres }] = await Promise.all([
    formationIds.length > 0 ? supabase.from('inscriptions_formations').select('acheteur_id').in('formation_id', formationIds) : Promise.resolve({ data: [] as any[] }),
    offreIds.length > 0 ? supabase.from('marketplace_commandes').select('acheteur_id').in('offre_id', offreIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const clientsMarketplace = new Set([...(acheteursFormations ?? []).map((a: any) => a.acheteur_id), ...(acheteursOffres ?? []).map((a: any) => a.acheteur_id)]).size

  const ancienneteJours = organisationInfo ? Math.floor((Date.now() - new Date(organisationInfo.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0

  return (
    <>
      <PageHeader eyebrowIcon={IdCard} eyebrowText="Mon espace Solo" title="Profil public" subtitle="Ce que les élèves et acheteurs potentiels voient de vous sur la marketplace." />

      <Panel className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-teal to-accent-teal-dim flex items-center justify-center font-display font-bold text-bg-base text-2xl">
            {organisation.nom.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="font-display text-xl text-text-primary flex items-center gap-2">
              {organisation.nom}
              {isFondateur && (
                <span className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                  FONDATEUR
                </span>
              )}
            </p>
            <p className="text-text-muted text-sm">{formationsPubliees?.length ?? 0} formation(s) publiée(s) sur la marketplace</p>
            {profilPublic?.bio && <p className="text-text-primary text-sm mt-2 max-w-xl">{profilPublic.bio}</p>}
            {profilPublic?.specialites && profilPublic.specialites.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profilPublic.specialites.map((s: string) => (
                  <span key={s} className="text-[11px] bg-bg-surface border border-border-soft text-text-muted px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-6">
        <StatCard icon={Star} label="Note de satisfaction" value={satisfaction?.note_moyenne ?? '—'} hint={satisfaction?.nombre_avis ? `${satisfaction.nombre_avis} avis reçus` : 'Aucun avis reçu'} />
        <StatCard icon={Users} label="Bénéficiaires accompagnés" value={beneficiairesAccompagnes ?? 0} />
        <StatCard icon={ShoppingBag} label="Clients marketplace" value={clientsMarketplace} hint="Formations + offres achetées" />
        <StatCard icon={CalendarClock} label="Ancienneté" value={`${ancienneteJours} j`} hint="Depuis la création de cet espace" />
      </div>

      <Panel title="Modifier ma présentation publique" className="mb-6">
        <form action={mettreAJourProfilPublic} className="space-y-3">
          <div>
            <label className="text-text-muted text-xs mb-1 block">Bio courte</label>
            <textarea
              name="bio"
              rows={3}
              defaultValue={profilPublic?.bio ?? ''}
              placeholder="Présentez-vous en quelques lignes…"
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Spécialités / thématiques (séparées par des virgules)</label>
            <input
              name="specialites"
              defaultValue={(profilPublic?.specialites ?? []).join(', ')}
              placeholder="ex. Gestion des émotions, Insertion professionnelle, Couture"
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
          </div>
          <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
            Enregistrer
          </button>
        </form>
      </Panel>

      <Panel title="Formations visibles publiquement">
        {(formationsPubliees ?? []).length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">Aucune formation publiée pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {(formationsPubliees ?? []).map((f: any) => (
              <li key={f.id} className="flex items-center justify-between text-sm border-b border-border-soft/60 last:border-0 py-2.5">
                <span className="text-text-primary">{f.titre}</span>
                <span className="font-data text-accent-gold text-sm">{f.prix != null ? `${f.prix} ${f.devise}` : '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
