import Link from 'next/link'
import { GraduationCap, Clock, Video, Users2, Banknote, Star, ShieldCheck, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel } from '../../../../(dashboard)/_components/ui'
import { calculerStatsFormateur } from '@/lib/formateurStats'
import { BadgeEnVerification } from '../../../../_components/BadgeEnVerification'
import { sInscrireFormation } from '../../../marketplace-actions'

const MODE_LABEL: Record<string, string> = {
  presentiel: 'Présentiel',
  video_tutoriel: 'Vidéo-tutoriel',
  mixte: 'Mixte — tous moyens',
  autre: 'Autre',
}

export default async function DetailOffreFormationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: formation } = await supabase
    .from('formations')
    .select('id, titre, description, prix, devise, duree_texte, mode_transmission, image_couverture_url, video_url, organisation_id, statut')
    .eq('id', id)
    .maybeSingle()

  if (!formation) return null

  const [{ data: offre }, { data: cours }, { data: avis }] = await Promise.all([
    supabase.from('marketplace_offres').select('statut').eq('formation_id', id).maybeSingle(),
    supabase.from('cours').select('id, titre, description, duree_minutes').eq('formation_id', id).order('ordre'),
    supabase.from('avis_formations').select('note, commentaire, created_at').eq('formation_id', id).order('created_at', { ascending: false }),
  ])

  const stats = await calculerStatsFormateur(supabase, formation.organisation_id)
  if (!stats) return null

  const enVerification = offre?.statut === 'visible_en_verification'
  const noteMoyenneFormation = avis && avis.length > 0 ? (avis.reduce((a, v: any) => a + v.note, 0) / avis.length).toFixed(1) : null
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={GraduationCap} eyebrowText="Marketplace" title={formation.titre} subtitle="Détail de la formation." />

      {enVerification && (
        <div className="mb-5">
          <BadgeEnVerification />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Panel>
            {formation.image_couverture_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={formation.image_couverture_url} alt={formation.titre} className="w-full h-56 object-cover rounded-xl mb-4" />
            )}
            {formation.description && <p className="text-text-primary text-sm leading-relaxed mb-4">{formation.description}</p>}
            <div className="flex flex-wrap gap-2 mb-4">
              {formation.duree_texte && (
                <span className="inline-flex items-center gap-1 text-[11.5px] bg-bg-surface border border-border-soft text-text-muted px-2.5 py-1 rounded-full">
                  <Clock size={12} /> {formation.duree_texte}
                </span>
              )}
              {formation.mode_transmission && (
                <span className="inline-flex items-center gap-1 text-[11.5px] bg-bg-surface border border-border-soft text-text-muted px-2.5 py-1 rounded-full">
                  {formation.mode_transmission === 'presentiel' ? <Users2 size={12} /> : <Video size={12} />} {MODE_LABEL[formation.mode_transmission]}
                </span>
              )}
              {formation.prix != null && (
                <span className="inline-flex items-center gap-1 text-[11.5px] bg-bg-surface border border-accent-gold-dim/50 text-accent-gold px-2.5 py-1 rounded-full">
                  <Banknote size={12} /> {formation.prix} {formation.devise}
                </span>
              )}
            </div>
            <form action={sInscrireFormation.bind(null, formation.id)}>
              <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[13px] font-semibold px-5 py-2.5 rounded-full">
                Je m'inscris
              </button>
            </form>
          </Panel>

          <Panel title="Programme" icon={BookOpen}>
            {(cours ?? []).length === 0 ? (
              <p className="text-text-muted text-sm py-4 text-center">Le programme détaillé n'a pas encore été renseigné par le formateur.</p>
            ) : (
              <ul className="space-y-2">
                {(cours ?? []).map((c: any) => (
                  <li key={c.id} className="border-b border-border-soft/60 last:border-0 py-2.5">
                    <p className="text-text-primary text-[13.5px] font-medium">{c.titre}</p>
                    {c.description && <p className="text-text-muted text-xs mt-0.5">{c.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Avis">
            {(avis ?? []).length === 0 ? (
              <p className="text-text-muted text-sm py-4 text-center">Aucun avis pour le moment.</p>
            ) : (
              <div className="space-y-3">
                <p className="flex items-center gap-1 text-accent-gold text-sm font-semibold">
                  <Star size={14} /> {noteMoyenneFormation}/5 ({avis?.length} avis)
                </p>
                <ul className="space-y-2.5">
                  {(avis ?? []).map((a: any, i: number) => (
                    <li key={i} className="bg-bg-surface border border-border-soft rounded-xl px-4 py-2.5">
                      <p className="flex items-center gap-1 text-accent-gold text-xs mb-1">
                        <Star size={11} /> {a.note}/5
                      </p>
                      {a.commentaire && <p className="text-text-primary text-[13px]">{a.commentaire}</p>}
                      <p className="text-text-muted text-[10.5px] mt-1">{formatter.format(new Date(a.created_at))}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>

        <div>
          <Panel title="Formateur">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-accent-teal to-accent-teal-dim flex items-center justify-center font-display font-bold text-bg-base text-xl shrink-0">
                {stats.profilPublic?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={stats.profilPublic.photo_url} alt={stats.organisation.nom} className="w-full h-full object-cover" />
                ) : (
                  stats.organisation.nom.slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <p className="font-display text-[15px] text-text-primary flex items-center gap-1.5 flex-wrap">
                  {stats.organisation.nom}
                  {stats.badgeVerifie && <ShieldCheck size={14} className="text-accent-teal" />}
                </p>
                {stats.estFondateur && (
                  <span className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[9px] font-bold px-1.5 py-0.5 rounded-full">FONDATEUR</span>
                )}
              </div>
            </div>
            {stats.profilPublic?.bio && <p className="text-text-muted text-[12.5px] mb-3">{stats.profilPublic.bio}</p>}
            <Link
              href={`/solo/marketplace/formateur/${stats.organisation.id}`}
              className="text-[12.5px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-3.5 py-1.5 inline-block"
            >
              Voir le profil complet
            </Link>
          </Panel>
        </div>
      </div>
    </>
  )
}
