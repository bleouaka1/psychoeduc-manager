import { Users, GraduationCap, Wallet, User, Store, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatCard, IgaDial, DataTable, StatusPill } from '../(dashboard)/_components/ui'
import { getSoloOrganisation } from './_lib/getSoloOrg'
import { sInscrireFormation } from './marketplace-actions'
import { NoterFormation } from './_components/NoterFormation'

export default async function SoloDashboardPage() {
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()

  const [{ data: beneficiaires }, { data: formations }, { data: paiementsFormation }] = await Promise.all([
    supabase
      .from('beneficiaires')
      .select('id, nom, prenoms, statut_beneficiaire, created_at')
      .eq('organisation_id', organisation.id)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('formations').select('id, statut').eq('organisation_id', organisation.id),
    supabase
      .from('paiements_formation')
      .select('montant, created_at, inscriptions_formations!inner(organisation_id)')
      .eq('inscriptions_formations.organisation_id', organisation.id)
      .eq('statut', 'confirme'),
  ])

  const beneficiaireIds = (beneficiaires ?? []).map((b) => b.id)
  const { data: scores } =
    beneficiaireIds.length > 0
      ? await supabase.from('evaluations_iga').select('score_global, beneficiaire_id').in('beneficiaire_id', beneficiaireIds)
      : { data: [] as any[] }

  const scoreMoyen = scores && scores.length > 0 ? Math.round(scores.reduce((a, s: any) => a + Number(s.score_global ?? 0), 0) / scores.length) : null

  const debutMois = new Date()
  debutMois.setDate(1)
  debutMois.setHours(0, 0, 0, 0)
  const revenusDuMois = (paiementsFormation ?? [])
    .filter((p: any) => new Date(p.created_at) >= debutMois)
    .reduce((a: number, p: any) => a + Number(p.montant ?? 0), 0)

  const formationsPubliees = (formations ?? []).filter((f: any) => f.statut === 'publiee').length

  const { data: marketplace } = await supabase
    .from('vue_marketplace_formations')
    .select('*')
    .neq('organisation_id', organisation.id)
    .limit(4)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: inscriptionsSuivies }, { data: mesAvis }] = await Promise.all([
    user
      ? supabase
          .from('inscriptions_formations')
          .select('id, formation_id, statut, formations(titre, organisation_id, organisations(nom))')
          .eq('acheteur_id', user.id)
      : Promise.resolve({ data: [] as any[] }),
    user ? supabase.from('avis_formations').select('formation_id, note, commentaire').eq('acheteur_id', user.id) : Promise.resolve({ data: [] as any[] }),
  ])

  const inscriptionIds = (inscriptionsSuivies ?? []).map((i: any) => i.id)
  const { data: progressions } =
    inscriptionIds.length > 0 ? await supabase.from('vue_progression_formations').select('inscription_id, pourcentage').in('inscription_id', inscriptionIds) : { data: [] as any[] }
  const progressionParInscription = new Map((progressions ?? []).map((p: any) => [p.inscription_id, p.pourcentage]))
  const avisParFormation = new Map((mesAvis ?? []).map((a: any) => [a.formation_id, a]))

  return (
    <>
      <PageHeader eyebrowIcon={User} eyebrowText="Mon espace Solo" title="Tableau de bord" subtitle="Vos bénéficiaires et vos formations, au même endroit." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard icon={Users} label="Bénéficiaires actifs" value={(beneficiaires ?? []).filter((b) => b.statut_beneficiaire === 'actif').length} hint="Suivi personnel" />
        <IgaDial value={scoreMoyen} label="Score IGA moyen (vos bénéficiaires)" />
        <StatCard icon={GraduationCap} label="Formations publiées" value={formationsPubliees} hint={`${(formations ?? []).length} au total`} />
        <StatCard icon={Wallet} label="Revenus du mois" value={`${revenusDuMois} FCFA`} hint="Ventes de formations" />
      </div>

      <Panel title="Mes bénéficiaires (aperçu)">
        <DataTable
          columns={['Nom', 'Statut', 'Ajouté le']}
          rows={(beneficiaires ?? []).map((b: any) => [
            `${b.nom} ${b.prenoms}`,
            <StatusPill key="s" status={b.statut_beneficiaire === 'actif' ? 'ok' : 'idle'}>{b.statut_beneficiaire}</StatusPill>,
            new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(b.created_at)),
          ])}
          emptyText="Aucun bénéficiaire pour le moment — rendez-vous dans « Mes bénéficiaires » pour en ajouter."
        />
      </Panel>

      <Panel title="Mes formations suivies" className="mt-6" icon={BookOpen}>
        {(inscriptionsSuivies ?? []).length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">Vous n'êtes inscrit à aucune formation d'un autre compte pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {(inscriptionsSuivies ?? []).map((i: any) => {
              const pourcentage = progressionParInscription.get(i.id) ?? 0
              const monAvis = avisParFormation.get(i.formation_id)
              return (
                <div key={i.id} className="bg-bg-surface border border-border-soft rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-text-primary text-[13.5px] font-medium font-display">{i.formations?.titre}</p>
                    <StatusPill status={i.statut === 'termine' ? 'ok' : i.statut === 'abandonne' ? 'down' : 'warn'}>{i.statut}</StatusPill>
                  </div>
                  <p className="text-text-muted text-[11.5px] mt-0.5">Par {i.formations?.organisations?.nom} — {pourcentage}% complété</p>
                  <NoterFormation
                    formationId={i.formation_id}
                    organisationId={i.formations?.organisation_id}
                    noteActuelle={monAvis?.note ?? null}
                    commentaireActuel={monAvis?.commentaire ?? null}
                  />
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title="Aperçu Marketplace (vue publique)" className="mt-6" icon={Store}>
        {(marketplace ?? []).length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">Aucune autre formation publiée sur la marketplace pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(marketplace ?? []).map((m: any) => (
              <div key={m.id} className="bg-bg-surface border border-border-soft rounded-xl p-4">
                <p className="font-display text-[15px] text-text-primary">{m.titre}</p>
                <p className="text-text-muted text-[11.5px] flex items-center gap-1.5 mt-0.5">
                  Par {m.organisation_nom}
                  {m.vendeur_est_fondateur && (
                    <span className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[9px] font-bold px-1.5 py-0.5 rounded-full">FONDATEUR</span>
                  )}
                </p>
                {m.description && <p className="text-text-muted text-xs my-2">{m.description}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="font-data text-accent-gold text-sm font-semibold">{m.prix != null ? `${m.prix} ${m.devise}` : '—'}</span>
                  <form action={sInscrireFormation.bind(null, m.id)}>
                    <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[12px] font-semibold px-3.5 py-1.5 rounded-full">
                      Je me lance
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  )
}
