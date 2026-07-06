import { Store, CheckCircle2, PauseCircle, Trash2, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard, StatusPill } from '../_components/ui'
import { validerOffreMarketplace, suspendreOffreMarketplace, supprimerOffreMarketplace, envoyerMessageOffre } from './actions'
import { ModerationModal } from './_components/ModerationModal'
import { DetailOffrePanel } from './_components/DetailOffrePanel'
import { STATUT_STYLE, STATUT_LABEL, VENDEUR_TYPE_LABEL } from './_lib/statuts'

const STATUTS_VALIDABLES = ['en_attente_validation', 'visible_en_verification']
const STATUTS_SUSPENDABLES = ['publiee', 'visible_en_verification']
const STATUTS_FILTRABLES = ['en_attente_validation', 'visible_en_verification', 'publiee', 'masquee', 'refusee', 'retiree']

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string; offre?: string }>
}) {
  const { statut = 'tout', q = '', offre: offreId } = await searchParams
  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')

  const paramsBase = `statut=${encodeURIComponent(statut)}&q=${encodeURIComponent(q)}`

  let offreDetail: any = null
  let messagesOffre: { id: string; contenu: string; created_at: string; auteur: string; estFondateur: boolean }[] = []
  if (offreId) {
    const { data: o } = await supabase
      .from('marketplace_offres')
      .select('titre, description, prix, devise, statut, type_offre, created_at, organisation_id, created_by, organisations(nom, type_organisation)')
      .eq('id', offreId)
      .maybeSingle()
    if (o) {
      const { data: profilPublic } = await supabase
        .from('profils_publics_formateurs')
        .select('bio, specialites')
        .eq('organisation_id', o.organisation_id)
        .maybeSingle()
      offreDetail = {
        ...o,
        organisation_nom: (o as any).organisations?.nom ?? null,
        organisation_type: (o as any).organisations?.type_organisation ?? null,
        vendeur_bio: profilPublic?.bio ?? null,
        vendeur_specialites: profilPublic?.specialites ?? [],
      }

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, contenu, created_at, expediteur_id, profiles!messages_expediteur_id_fkey(nom, prenoms, email)')
        .eq('marketplace_offre_id', offreId)
        .order('created_at', { ascending: true })
      messagesOffre = (msgs ?? []).map((m: any) => ({
        id: m.id,
        contenu: m.contenu,
        created_at: m.created_at,
        auteur: m.expediteur_id === o.created_by ? 'Vendeur' : (m.profiles?.nom ? `${m.profiles.nom} (Fondateur)` : 'Fondateur'),
        estFondateur: m.expediteur_id !== o.created_by,
      }))
    }
  }

  // Même précaution que la recherche marketplace publique (Compte Solo) : on retire
  // les caractères pouvant détourner un filtre PostgREST avant de les interpoler.
  const qNettoye = q.trim().replace(/[,().]/g, ' ').slice(0, 200)

  let requeteOrganisationsIds: string[] = []
  if (qNettoye) {
    const { data: orgs } = await supabase.from('organisations').select('id').ilike('nom', `%${qNettoye}%`)
    requeteOrganisationsIds = (orgs ?? []).map((o: any) => o.id)
  }

  let requeteOffres = supabase
    .from('marketplace_offres')
    .select('id, titre, type_offre, prix, statut, created_at, nombre_signalements, organisation_id, organisations(nom, type_organisation)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (statut !== 'tout') requeteOffres = requeteOffres.eq('statut', statut)
  if (qNettoye) {
    const clauseOrganisation = requeteOrganisationsIds.length > 0 ? `,organisation_id.in.(${requeteOrganisationsIds.join(',')})` : ''
    requeteOffres = requeteOffres.or(`titre.ilike.%${qNettoye}%${clauseOrganisation}`)
  }

  const [{ data: offres }, { data: signalements }, { data: vue }] = await Promise.all([
    requeteOffres,
    supabase.from('marketplace_signalements').select('id, motif, statut, created_at, marketplace_offres(titre)').order('created_at', { ascending: false }).limit(30),
    supabase.from('vue_marketplace').select('*').single(),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={Store} eyebrowText="Modération" title="Marketplace" subtitle="Offres de formations, services et produits — validation Fondateur obligatoire avant publication." />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-8">
        <StatCard icon={Store} label="Offres publiées" value={vue?.offres_publiees ?? 0} />
        <StatCard icon={Store} label="En attente de validation" value={vue?.offres_en_attente ?? 0} />
        <StatCard icon={Store} label="Masquées (signalements)" value={vue?.offres_masquees ?? 0} />
        <StatCard icon={Store} label="Commission confirmée" value={`${vue?.commission_totale_confirmee ?? 0} FCFA`} />
      </div>

      <div className="space-y-6">
        {offreDetail && (
          <DetailOffrePanel
            offre={offreDetail}
            closeHref={`/marketplace?${paramsBase}`}
            messages={messagesOffre}
            envoyerMessage={envoyerMessageOffre.bind(null, offreId!)}
            peutEnvoyerMessage={Boolean(estFondateur)}
          />
        )}

        <Panel title={`${offres?.length ?? 0} offre(s) — Modération Marketplace`}>
          <form action="/marketplace" method="get" className="flex flex-wrap gap-2.5 mb-5">
            <select name="statut" defaultValue={statut} className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary">
              <option value="tout">Tous les statuts</option>
              {STATUTS_FILTRABLES.map((s) => (
                <option key={s} value={s}>
                  {STATUT_LABEL[s]}
                </option>
              ))}
            </select>
            <input
              name="q"
              defaultValue={q}
              placeholder="Rechercher par titre ou nom de vendeur…"
              className="flex-1 min-w-[220px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
            <button type="submit" className="text-[13px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-4 py-2">
              Filtrer
            </button>
          </form>

          <DataTable
            columns={['Titre', 'Vendeur', 'Type', 'Prix', 'Date de création', 'Statut', 'Signalements', 'Actions']}
            rows={(offres ?? []).map((o: any) => [
              o.titre,
              `${o.organisations?.nom ?? '—'} (${VENDEUR_TYPE_LABEL[o.organisations?.type_organisation] ?? o.organisations?.type_organisation ?? '—'})`,
              o.type_offre ?? '—',
              o.prix != null ? `${o.prix} FCFA` : '—',
              formatter.format(new Date(o.created_at)),
              <StatusPill key="s" status={STATUT_STYLE[o.statut] ?? 'idle'}>{STATUT_LABEL[o.statut] ?? o.statut}</StatusPill>,
              o.nombre_signalements,
              <div key="actions" className="flex flex-wrap gap-1.5">
                <a
                  href={`/marketplace?${paramsBase}&offre=${o.id}`}
                  className="flex items-center gap-1 text-[12px] border border-border-soft text-text-muted hover:text-text-primary rounded-lg px-2.5 py-1.5"
                >
                  <Eye size={13} /> Détail
                </a>
                {estFondateur && STATUTS_VALIDABLES.includes(o.statut) && (
                  <ModerationModal
                    action={validerOffreMarketplace.bind(null, o.id)}
                    triggerLabel="Valider"
                    triggerIcon={<CheckCircle2 size={13} />}
                    triggerClassName="flex items-center gap-1 text-[12px] border border-status-ok/40 text-status-ok rounded-lg px-2.5 py-1.5"
                    title="Valider cette offre ?"
                    message={`« ${o.titre} » sera publiée sur la marketplace et visible de tous les acheteurs.`}
                    confirmLabel="Valider"
                    confirmClassName="text-[13px] font-semibold text-bg-base bg-status-ok rounded-full px-4 py-2"
                  />
                )}
                {STATUTS_SUSPENDABLES.includes(o.statut) && (
                  <ModerationModal
                    action={suspendreOffreMarketplace.bind(null, o.id)}
                    triggerLabel="Suspendre"
                    triggerIcon={<PauseCircle size={13} />}
                    triggerClassName="flex items-center gap-1 text-[12px] border border-status-warn/40 text-status-warn rounded-lg px-2.5 py-1.5"
                    title="Suspendre cette offre ?"
                    message={`« ${o.titre} » redeviendra immédiatement invisible aux acheteurs, sans suppression — récupérable plus tard.`}
                    confirmLabel="Suspendre"
                    confirmClassName="text-[13px] font-semibold text-bg-base bg-status-warn rounded-full px-4 py-2"
                    showMotif
                    motifPlaceholder="Motif de la suspension (optionnel, notifié au vendeur)…"
                  />
                )}
                {o.statut !== 'retiree' && (
                  <ModerationModal
                    action={supprimerOffreMarketplace.bind(null, o.id)}
                    triggerLabel="Supprimer"
                    triggerIcon={<Trash2 size={13} />}
                    triggerClassName="flex items-center gap-1 text-[12px] border border-danger/40 text-danger rounded-lg px-2.5 py-1.5"
                    title="Supprimer cette offre ?"
                    message={`Action plus définitive que « Suspendre » : « ${o.titre} » disparaîtra de toutes les vues publiques (aucune suppression physique, l'historique reste consultable).`}
                    confirmLabel="Supprimer"
                    confirmClassName="text-[13px] font-semibold text-bg-base bg-danger rounded-full px-4 py-2"
                    showMotif
                    motifPlaceholder="Motif de la suppression (optionnel, notifié au vendeur)…"
                  />
                )}
              </div>,
            ])}
            emptyText="Aucune offre ne correspond à ces filtres pour le moment."
          />
        </Panel>

        <Panel title="Signalements récents">
          <DataTable
            columns={['Offre', 'Motif', 'Statut', 'Date']}
            rows={(signalements ?? []).map((s: any) => [s.marketplace_offres?.titre ?? '—', s.motif ?? '—', s.statut, formatter.format(new Date(s.created_at))])}
            emptyText="Aucun signalement pour le moment."
          />
        </Panel>
      </div>
    </>
  )
}
