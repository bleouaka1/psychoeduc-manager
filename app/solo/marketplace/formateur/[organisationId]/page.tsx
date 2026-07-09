import { IdCard, Star, Users, CalendarClock, ShoppingBag, TrendingUp, ShieldCheck, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatCard } from '../../../../(dashboard)/_components/ui'
import { calculerStatsFormateur } from '@/lib/formateurStats'
import { ContacterFormateur } from '../ContacterFormateur'

export default async function ProfilPublicFormateurPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const supabase = await createClient()
  const stats = await calculerStatsFormateur(supabase, organisationId)
  if (!stats) return null

  return (
    <>
      <PageHeader eyebrowIcon={IdCard} eyebrowText="Marketplace" title={stats.organisation.nom} subtitle="Profil public du formateur." />

      <Panel className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-accent-teal to-accent-teal-dim flex items-center justify-center font-display font-bold text-bg-base text-2xl shrink-0">
              {stats.profilPublic?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stats.profilPublic.photo_url} alt={stats.organisation.nom} className="w-full h-full object-cover" />
              ) : (
                stats.organisation.nom.slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <p className="font-display text-xl text-text-primary flex items-center gap-2 flex-wrap">
                {stats.organisation.nom}
                {stats.estFondateur && (
                  <span className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">FONDATEUR</span>
                )}
                {stats.badgeVerifie && (
                  <span className="flex items-center gap-1 bg-accent-teal-dim text-[#bff2ec] text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                    <ShieldCheck size={11} /> VÉRIFIÉ
                  </span>
                )}
              </p>
              <p className="text-text-muted text-sm">{stats.formationsPubliees.length} formation(s) publiée(s) sur la marketplace</p>
              {stats.profilPublic?.bio && <p className="text-text-primary text-sm mt-2 max-w-xl">{stats.profilPublic.bio}</p>}
              {stats.profilPublic && stats.profilPublic.specialites.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {stats.profilPublic.specialites.map((s) => (
                    <span key={s} className="text-[11px] bg-bg-surface border border-border-soft text-text-muted px-2 py-0.5 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {stats.ipp && (
                <p className="text-[11.5px] text-text-muted mt-2">
                  <span className="font-data font-semibold text-accent-teal">{Math.round(stats.ipp.score)}</span> IPP — indice de performance basé sur des résultats vérifiés
                </p>
              )}
            </div>
          </div>
          <ContacterFormateur organisationId={stats.organisation.id} nomFormateur={stats.organisation.nom} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-5 mb-6">
        <StatCard icon={Star} label="Note de satisfaction" value={stats.noteMoyenne ?? '—'} hint={stats.nombreAvis ? `${stats.nombreAvis} avis reçus` : 'Aucun avis reçu'} />
        <StatCard icon={Users} label="Bénéficiaires accompagnés" value={stats.beneficiairesAccompagnes} />
        <StatCard icon={TrendingUp} label="Taux de réussite" value={stats.tauxReussite != null ? `${stats.tauxReussite}%` : '—'} />
        <StatCard icon={ShoppingBag} label="Clients marketplace" value={stats.clientsMarketplace} />
        <StatCard icon={CalendarClock} label="Ancienneté" value={`${stats.ancienneteJours} j`} />
      </div>

      {stats.profilPublic?.cv_texte && (
        <Panel title="Parcours" icon={FileText} className="mb-6">
          <p className="text-text-primary text-sm whitespace-pre-line">{stats.profilPublic.cv_texte}</p>
        </Panel>
      )}

      {stats.profilPublic?.cv_url && (
        <Panel title="CV" icon={FileText} className="mb-6">
          <a href={stats.profilPublic.cv_url} target="_blank" rel="noreferrer" className="text-accent-gold hover:underline text-sm">
            Consulter le CV
          </a>
        </Panel>
      )}

      <Panel title="Formations publiées">
        {stats.formationsPubliees.length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">Aucune formation publiée pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {stats.formationsPubliees.map((f) => (
              <li key={f.id} className="flex items-center justify-between text-sm border-b border-border-soft/60 last:border-0 py-2.5">
                <a href={`/solo/marketplace/formation/${f.id}`} className="text-text-primary hover:text-accent-gold">
                  {f.titre}
                </a>
                <span className="font-data text-accent-gold text-sm">{f.prix != null ? `${f.prix} ${f.devise}` : '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
