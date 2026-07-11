import { IdCard, Star, Users, CalendarClock, ShoppingBag, TrendingUp, ShieldCheck, FileText, Gauge, Trophy, MessageSquareQuote } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatCard } from '../../../../(dashboard)/_components/ui'
import { calculerStatsFormateur } from '@/lib/formateurStats'
import { calculerIppOrganisation, calculerPaliersReussite, chargerAvisPublies } from '@/lib/ippServer'
import { ContacterFormateur } from '../ContacterFormateur'

const PILIER_LABEL: Record<string, string> = {
  impactReel: 'Impact réel',
  qualiteSuivi: 'Qualité et régularité du suivi',
  rigueurDocumentaire: 'Rigueur documentaire',
  satisfaction: 'Satisfaction bénéficiaires',
}

const PALIER_LABEL: Record<string, string> = { reussir_1: 'Réussir 1', reussir_2: 'Réussir 2', terminus: 'Terminus' }

function BarrePilier({ label, valeur }: { label: string; valeur: number | null }) {
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1">
        <span className="text-text-muted">{label}</span>
        <span className="font-data text-text-primary">{valeur != null ? `${Math.round(valeur)}/100` : '—'}</span>
      </div>
      <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-accent-gold to-accent-gold-dim rounded-full" style={{ width: `${valeur ?? 0}%` }} />
      </div>
    </div>
  )
}

export default async function ProfilPublicFormateurPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const supabase = await createClient()
  const stats = await calculerStatsFormateur(supabase, organisationId)
  if (!stats) return null

  const [ipp, paliers, avis, { data: dimensionsNoms }] = await Promise.all([
    calculerIppOrganisation(supabase, organisationId),
    calculerPaliersReussite(supabase, organisationId),
    chargerAvisPublies(supabase, organisationId),
    supabase.from('dimensions_iga').select('code, nom').in('code', stats.profilPublic?.specialitesDimensionsIga ?? []),
  ])
  const nomParCode = new Map((dimensionsNoms ?? []).map((d: any) => [d.code, d.nom]))

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
              {stats.profilPublic && stats.profilPublic.specialitesDimensionsIga.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {stats.profilPublic.specialitesDimensionsIga.map((code) => (
                    <span key={code} className="text-[11px] bg-bg-surface border border-border-soft text-text-muted px-2 py-0.5 rounded-full">
                      {nomParCode.get(code) ?? code}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <ContacterFormateur organisationId={stats.organisation.id} nomFormateur={stats.organisation.nom} />
        </div>
      </Panel>

      <Panel title="Indice de Performance Pédagogique (IPP)" icon={Gauge} className="mb-6">
        {!ipp.echantillonSuffisant || ipp.score == null ? (
          <p className="text-text-muted text-sm py-3">IPP en cours de constitution — historique encore insuffisant pour un score représentatif.</p>
        ) : (
          <>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="font-data text-3xl text-accent-gold font-bold">{ipp.score}</span>
              <span className="text-text-muted text-sm">/100 — {ipp.niveau}</span>
            </div>
            <div className="space-y-3 max-w-md">
              {(Object.entries(ipp.piliers) as [string, number | null][]).map(([code, valeur]) => (
                <BarrePilier key={code} label={PILIER_LABEL[code]} valeur={valeur} />
              ))}
            </div>
          </>
        )}
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-5 mb-6">
        <StatCard icon={Star} label="Note de satisfaction" value={stats.noteMoyenne ?? '—'} hint={stats.nombreAvis ? `${stats.nombreAvis} avis reçus` : 'Aucun avis reçu'} />
        <StatCard icon={Users} label="Bénéficiaires accompagnés" value={stats.beneficiairesAccompagnes} />
        <StatCard icon={TrendingUp} label="Taux de réussite" value={stats.tauxReussite != null ? `${stats.tauxReussite}%` : '—'} />
        <StatCard icon={ShoppingBag} label="Clients marketplace" value={stats.clientsMarketplace} />
        <StatCard icon={CalendarClock} label="Ancienneté" value={`${stats.ancienneteJours} j`} />
      </div>

      {(paliers.reussir1 > 0 || paliers.reussir2 > 0 || paliers.terminus > 0) && (
        <Panel title="Paliers de réussite long terme" icon={Trophy} className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {paliers.reussir1 > 0 && <StatCard icon={Trophy} label="Réussir 1 (1 an)" value={paliers.reussir1} />}
            {paliers.reussir2 > 0 && <StatCard icon={Trophy} label="Réussir 2 (2 ans)" value={paliers.reussir2} />}
            {paliers.terminus > 0 && <StatCard icon={Trophy} label="Terminus (3 ans)" value={paliers.terminus} />}
          </div>
        </Panel>
      )}

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

      <Panel title="Formations publiées" className="mb-6">
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

      <Panel title="Avis et témoignages" icon={MessageSquareQuote}>
        {avis.length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">Aucun avis publié pour le moment.</p>
        ) : (
          <ul className="space-y-3">
            {avis.map((a) => (
              <li key={a.id} className="border-b border-border-soft/60 last:border-0 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-text-primary text-[13.5px] font-medium">{a.auteurLabel}</span>
                  <span className="font-data text-accent-gold text-sm">{a.note}/5</span>
                </div>
                {a.texte && <p className="text-text-muted text-[13px] mb-1">{a.texte}</p>}
                <p className="text-text-muted text-[11px]">
                  {a.dureeJoursSuivi} jour(s) de suivi{a.palier && ` — ${PALIER_LABEL[a.palier]}`} —{' '}
                  {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(a.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
