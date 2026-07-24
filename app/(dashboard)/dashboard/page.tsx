import {
  Crown,
  Activity,
  Siren,
  History,
  Building,
  Users,
  BarChart3,
  CreditCard,
  Gift,
  School,
  Factory,
  UserCog,
  Wallet,
  Trophy,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatCard, StatusPill, EmptyState, IgaDial } from '../_components/ui'
import { getMonOrganisation } from '../_lib/getMonOrganisation'
import { organisationApercuActive } from '@/lib/apercu'
import { StructureDashboard } from './StructureDashboard'

/**
 * '/dashboard' sert deux publics distincts (§5 du document Compte Structure) : le
 * Fondateur voit le panorama plateforme (ci-dessous, INCHANGÉ) ; tout membre d'une
 * organisation Structure (Directeur/Coordinateur/Éducateur/Formateur/Promoteur) voit
 * à la place son propre tableau de bord org-scopé (StructureDashboard.tsx, nouveau
 * fichier séparé plutôt que branché en plein milieu de ce composant existant — évite
 * tout risque de régression sur la vue Fondateur).
 */
export default async function Home() {
  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')

  // getMonOrganisation() n'est appelée pour un Fondateur QUE si le mode Aperçu
  // (`lib/apercu.ts`) est actif — sinon un Fondateur incidemment membre d'une organisation
  // (ex. propre compte de test créé via self-signup) verrait CETTE organisation plutôt que
  // le panorama plateforme, cassant le comportement d'origine "Fondateur = toujours global".
  const apercuActif = estFondateur ? await organisationApercuActive() : null
  if (!estFondateur || apercuActif) {
    const organisation = await getMonOrganisation()
    if (organisation) return <StructureDashboard organisation={organisation} />
  }

  if (!estFondateur) {
    // Ni organisation Structure, ni Fondateur : redirigé par le middleware avant d'arriver
    // ici en temps normal, mais gardé par prudence (aucune donnée plateforme à exposer).
    return null
  }

  const [{ data: dash, error: dashError }, { data: audit }, { data: derniereSauvegarde }, alertesResult] =
    await Promise.all([
      supabase.from('vue_dashboard_fondateur').select('*').single(),
      supabase
        .from('audit_logs')
        .select('id, action, table_cible, created_at, profiles(email)')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('sauvegardes_export')
        .select('statut, date_creation, type_export')
        .order('date_creation', { ascending: false })
        .limit(1)
        .maybeSingle(),
      Promise.all([
        supabase
          .from('tickets_support')
          .select('id', { count: 'exact', head: true })
          .in('statut', ['ouvert', 'en_cours'])
          .in('priorite', ['haute', 'urgente']),
        supabase
          .from('marketplace_signalements')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'en_attente'),
        supabase
          .from('alertes_assiduite')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'active'),
        supabase
          .from('licences')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'actif')
          .not('date_fin', 'is', null)
          .lte('date_fin', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]),
    ])

  const d: any = dash || {}
  const [ticketsUrgents, signalementsEnAttente, alertesAssiduite, licencesExpirant] = alertesResult

  const cards = [
    { icon: Building, label: 'Organisations', value: d.total_organisations ?? 0, hint: 'Solo, structures, employeurs' },
    { icon: Users, label: 'Bénéficiaires', value: d.total_beneficiaires ?? 0, hint: 'Personnes suivies' },
    { icon: BarChart3, label: 'Évaluations IGA', value: d.total_evaluations_iga ?? 0, hint: 'Indice Général d’Autonomie' },
    { icon: CreditCard, label: 'Licences actives', value: d.licences_actives ?? 0, hint: 'Abonnements en cours' },
    { icon: Gift, label: 'Essais gratuits', value: d.essais_gratuits_en_cours ?? 0, hint: 'Non convertis, non expirés' },
    { icon: School, label: 'Structures', value: d.total_structures ?? 0, hint: 'Écoles, ONG, centres' },
    { icon: Factory, label: 'Employeurs', value: d.total_employeurs ?? 0, hint: 'Entreprises partenaires' },
    { icon: UserCog, label: 'Personnel', value: d.total_personnel ?? 0, hint: 'Éducateurs, formateurs, coachs' },
    { icon: Wallet, label: 'Revenus confirmés', value: `${d.revenus_confirmes_total ?? 0} FCFA`, hint: 'Paiements validés' },
    { icon: Trophy, label: 'Réussites confirmées', value: d.total_reussites_confirmees ?? 0, hint: 'Parcours validés par un humain' },
  ] as const

  const alertes = [
    { label: 'Tickets support urgents', total: ticketsUrgents.count ?? 0 },
    { label: 'Signalements marketplace en attente', total: signalementsEnAttente.count ?? 0 },
    { label: 'Alertes d’assiduité actives', total: alertesAssiduite.count ?? 0 },
    { label: 'Licences expirant sous 30 jours', total: licencesExpirant.count ?? 0 },
  ]

  const timeFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <PageHeader
        eyebrowIcon={Crown}
        eyebrowText="Cockpit Fondateur"
        title="Vue générale"
        subtitle="Panorama complet de PsychoÉduc Manager, en temps réel."
      />

      {dashError && (
        <Panel className="mb-6 border-danger/40">
          <p className="text-danger text-sm">
            Impossible de charger le tableau de bord avec la session actuelle. Vérifie que ton compte a bien un rôle attribué.
          </p>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-5 mb-5">
        <Panel title="Centre de commandement" icon={Activity}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <CommandTile label="Santé plateforme" status={dashError ? 'down' : 'ok'} value={dashError ? 'Dégradée' : 'Opérationnelle'} />
            <CommandTile label="Base de données" status="ok" value="Connectée" />
            <CommandTile label="Serveur" status="ok" value="Actif" />
            <CommandTile
              label="Sauvegarde"
              status={derniereSauvegarde ? (derniereSauvegarde.statut === 'prete' ? 'ok' : 'warn') : 'idle'}
              value={
                derniereSauvegarde
                  ? `${derniereSauvegarde.type_export} — ${derniereSauvegarde.statut}`
                  : 'Aucune enregistrée'
              }
            />
          </div>
        </Panel>

        <Panel title="Alertes prioritaires" icon={Siren}>
          <ul className="space-y-1">
            {alertes.map((a) => {
              const active = a.total > 0
              return (
                <li
                  key={a.label}
                  className={`flex items-center justify-between text-[13.5px] px-3 py-[11px] rounded-lg ${
                    active
                      ? 'bg-[var(--alert-bg)] border border-[var(--alert-border)]'
                      : 'border-b border-border-soft last:border-0 rounded-none px-0'
                  }`}
                >
                  <span className="text-text-muted">{a.label}</span>
                  <span className="font-data font-semibold text-text-muted">{a.total}</span>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-[18px] mb-5">
        {cards.slice(0, 2).map((c) => (
          <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} hint={c.hint} />
        ))}
        <IgaDial value={d.score_iga_moyen ?? null} />
        {cards.slice(2).map((c) => (
          <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} hint={c.hint} />
        ))}
      </section>

      <Panel title="Activité récente" icon={History}>
        {audit && audit.length > 0 ? (
          <ul className="divide-y divide-border-soft/60">
            {audit.map((a: any) => (
              <li key={a.id} className="py-3 flex items-center justify-between text-sm gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusPill status={a.action === 'DELETE' ? 'down' : a.action === 'INSERT' ? 'ok' : 'warn'}>
                    {a.action}
                  </StatusPill>
                  <span className="text-text-primary truncate">
                    {a.table_cible}
                    {a.profiles?.email && <span className="text-text-muted"> — {a.profiles.email}</span>}
                  </span>
                </div>
                <span className="text-text-muted whitespace-nowrap font-data text-xs">{timeFormatter.format(new Date(a.created_at))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState text="Aucune activité enregistrée pour le moment." />
        )}
      </Panel>

      <footer className="mt-10 text-text-muted text-[12.5px] font-display italic text-center">
        PsychoÉduc Manager — Transformer les potentiels en réussites durables.
      </footer>
    </>
  )
}

function CommandTile({ label, value, status }: { label: string; value: string; status: 'ok' | 'warn' | 'down' | 'idle' }) {
  return (
    <div className="bg-bg-surface border border-border-soft rounded-xl p-3.5">
      <p className="text-xs text-text-muted mb-2">{label}</p>
      <StatusPill status={status}>{value}</StatusPill>
    </div>
  )
}
