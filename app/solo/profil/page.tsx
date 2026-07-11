import { IdCard, Star, Users, CalendarClock, ShoppingBag, TrendingUp, ShieldCheck, FileText, Gauge } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatCard } from '../../(dashboard)/_components/ui'
import { getSoloOrganisation, getIsFondateur } from '../_lib/getSoloOrg'
import { mettreAJourProfilPublic } from '../profil-actions'
import { calculerStatsFormateur } from '@/lib/formateurStats'
import { calculerIppOrganisation } from '@/lib/ippServer'
import { UploadPhotoProfil } from '../_components/UploadPhotoProfil'

const PILIER_LABEL: Record<string, string> = {
  impactReel: 'Impact réel',
  qualiteSuivi: 'Qualité et régularité du suivi',
  rigueurDocumentaire: 'Rigueur documentaire',
  satisfaction: 'Satisfaction bénéficiaires',
}

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

export default async function SoloProfilPage() {
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const isFondateur = await getIsFondateur()
  const supabase = await createClient()
  const stats = await calculerStatsFormateur(supabase, organisation.id)
  if (!stats) return null
  const ipp = await calculerIppOrganisation(supabase, organisation.id)

  // Une dimension peut porter des libellés légèrement différents entre référentiels
  // IGA (ex. "Emploi / activité" vs "Emploi / activité professionnelle") — un seul
  // libellé retenu par code pour la liste de spécialités, cf. PLAN_IGA_MARKETPLACE_MATCHING.md.
  const { data: dimensionsBrutes } = await supabase
    .from('dimensions_iga')
    .select('code, nom')
    .in('referentiel_id', (await supabase.from('referentiels_iga').select('id').in('code', ['iga_e', 'iga_a', 'iga_j', 'iga_ad'])).data?.map((r: any) => r.id) ?? [])
  const dimensionsIga = Array.from(new Map((dimensionsBrutes ?? []).map((d: any) => [d.code, d.nom])).entries())
    .map(([code, nom]) => ({ code, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom))

  return (
    <>
      <PageHeader eyebrowIcon={IdCard} eyebrowText="Mon espace Solo" title="Profil public" subtitle="Ce que les élèves et acheteurs potentiels voient de vous sur la marketplace." />

      <Panel className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <UploadPhotoProfil organisationId={organisation.id} photoActuelle={stats.profilPublic?.photo_url ?? null} />
          <div>
            <p className="font-display text-xl text-text-primary flex items-center gap-2 flex-wrap">
              {organisation.nom}
              {isFondateur && (
                <span className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                  FONDATEUR
                </span>
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
                {stats.profilPublic.specialites.map((s: string) => (
                  <span key={s} className="text-[11px] bg-bg-surface border border-border-soft text-text-muted px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {!stats.badgeVerifie && (
          <p className="text-text-muted text-[11.5px] border-t border-border-soft pt-3 mt-1">
            Badge « Vérifié » non obtenu : ajoutez une photo et une bio, et publiez au moins une formation pour l'obtenir.
          </p>
        )}
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
        <StatCard icon={TrendingUp} label="Taux de réussite" value={stats.tauxReussite != null ? `${stats.tauxReussite}%` : '—'} hint="Réussites confirmées" />
        <StatCard icon={ShoppingBag} label="Clients marketplace" value={stats.clientsMarketplace} hint="Formations + offres achetées" />
        <StatCard icon={CalendarClock} label="Ancienneté" value={`${stats.ancienneteJours} j`} hint="Depuis la création de cet espace" />
      </div>

      <Panel title="Modifier ma présentation publique" className="mb-6">
        <form action={mettreAJourProfilPublic} className="space-y-3">
          <div>
            <label className="text-text-muted text-xs mb-1 block">Bio courte (400 caractères max)</label>
            <textarea
              name="bio"
              rows={3}
              maxLength={400}
              defaultValue={stats.profilPublic?.bio ?? ''}
              placeholder="Présentez-vous en quelques lignes…"
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Spécialités / thématiques (séparées par des virgules)</label>
            <input
              name="specialites"
              defaultValue={stats.profilPublic?.specialites.join(', ') ?? ''}
              placeholder="ex. Gestion des émotions, Insertion professionnelle, Couture"
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1.5 block">
              Spécialités IGA (dimensions sur lesquelles vous êtes recommandé aux bénéficiaires en difficulté)
            </label>
            <div className="flex flex-wrap gap-2">
              {dimensionsIga.map((dim) => (
                <label
                  key={dim.code}
                  className="flex items-center gap-1.5 text-[12px] text-text-muted bg-bg-surface border border-border-soft rounded-full px-3 py-1.5 cursor-pointer has-[:checked]:border-accent-gold-dim has-[:checked]:text-text-primary"
                >
                  <input
                    type="checkbox"
                    name="specialites_dimensions_iga"
                    value={dim.code}
                    defaultChecked={stats.profilPublic?.specialitesDimensionsIga.includes(dim.code)}
                  />
                  {dim.nom}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Lien vers un CV (PDF hébergé ailleurs — pas d'upload direct pour l'instant)</label>
            <input
              name="cv_url"
              type="url"
              defaultValue={stats.profilPublic?.cv_url ?? ''}
              placeholder="https://…"
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">CV structuré (expérience, diplômes, spécialités détaillées)</label>
            <textarea
              name="cv_texte"
              rows={5}
              defaultValue={stats.profilPublic?.cv_texte ?? ''}
              placeholder="Expérience professionnelle, diplômes, spécialités…"
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
          </div>
          <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
            Enregistrer
          </button>
        </form>
      </Panel>

      {stats.profilPublic?.cv_url && (
        <Panel title="CV" icon={FileText} className="mb-6">
          <a href={stats.profilPublic.cv_url} target="_blank" rel="noreferrer" className="text-accent-gold hover:underline text-sm">
            Consulter le CV
          </a>
        </Panel>
      )}

      <Panel title="Formations visibles publiquement">
        {stats.formationsPubliees.length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">Aucune formation publiée pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {stats.formationsPubliees.map((f) => (
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
