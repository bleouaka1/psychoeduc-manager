import Link from 'next/link'
import { Building2, Users, UserCog, Gauge, CalendarCheck, UserPlus, School } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatCard, StatusPill, EmptyState, IgaDial } from '../_components/ui'
import type { MonOrganisation } from '../_lib/getMonOrganisation'

const ROLE_LABEL: Record<string, string> = {
  promoteur: 'Promoteur',
  directeur: 'Directeur',
  coordinateur: 'Coordinateur',
  educateur: 'Éducateur',
  formateur: 'Formateur',
  administrateur: 'Administrateur',
}

/**
 * Tableau de bord Directeur/Éducateur/Formateur (§5) — vue org-scopée, distincte de
 * la vue globale du Fondateur (Home() dans page.tsx, intacte). Un même compte peut
 * voir l'une ou l'autre selon is_fondateur() ; RLS scope de toute façon chaque requête
 * ci-dessous à `organisation.id`, aucune fuite inter-organisations possible même en cas
 * d'erreur de code. Funnel 6 étapes et classement IPP (§5) volontairement absents de
 * cette V1 — nécessitent de vérifier l'infrastructure existante (parcours/IPP) plus en
 * détail que le temps de cette session ne le permettait ; signalé plutôt que bâclé.
 */
export async function StructureDashboard({ organisation }: { organisation: MonOrganisation }) {
  const supabase = await createClient()
  const aujourdHui = new Date().toISOString().slice(0, 10)

  const [
    { count: nbEtablissements },
    { count: nbBeneficiaires },
    { data: membres },
    { data: evaluations },
    { data: presencesJour },
    { count: nbInvitationsEnAttente },
  ] = await Promise.all([
    supabase.from('etablissements').select('id', { count: 'exact', head: true }).eq('organisation_id', organisation.id).eq('actif', true),
    supabase.from('beneficiaires').select('id', { count: 'exact', head: true }).eq('organisation_id', organisation.id).eq('statut_beneficiaire', 'actif'),
    supabase.from('membres_organisations').select('roles_utilisateurs(role, actif)').eq('organisation_id', organisation.id).eq('statut', 'actif'),
    supabase.from('evaluations_iga').select('score_global').eq('organisation_id', organisation.id).order('date_evaluation', { ascending: false }).limit(200),
    supabase.from('presences').select('statut').eq('organisation_id', organisation.id).eq('date_seance', aujourdHui),
    supabase.from('invitations_utilisateurs').select('id', { count: 'exact', head: true }).eq('organisation_id', organisation.id).eq('statut', 'en_attente'),
  ])

  const repartitionRoles = new Map<string, number>()
  for (const m of membres ?? []) {
    for (const r of (m as any).roles_utilisateurs ?? []) {
      if (r.actif) repartitionRoles.set(r.role, (repartitionRoles.get(r.role) ?? 0) + 1)
    }
  }

  const scoresValides = (evaluations ?? []).map((e: any) => e.score_global).filter((s: number | null) => s !== null)
  const igaMoyen = scoresValides.length > 0 ? Math.round(scoresValides.reduce((a: number, b: number) => a + b, 0) / scoresValides.length) : null

  const presencesParStatut = { present: 0, absent: 0, retard: 0 }
  for (const p of presencesJour ?? []) {
    if (p.statut in presencesParStatut) presencesParStatut[p.statut as keyof typeof presencesParStatut]++
  }

  return (
    <>
      <PageHeader
        eyebrowIcon={School}
        eyebrowText={organisation.roles.map((r) => ROLE_LABEL[r] ?? r).join(' · ') || 'Structure'}
        title={organisation.nom}
        subtitle="Vue d'ensemble de votre organisation, en temps réel."
        actions={
          <div className="flex items-center gap-2.5">
            <Link href="/invitations" className="flex items-center gap-1.5 bg-bg-card border border-border-soft text-text-primary text-[13px] font-medium px-4 py-2.5 rounded-full">
              <UserPlus size={14} /> Invitations
            </Link>
            <Link href="/assignations" className="flex items-center gap-1.5 bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[13px] font-semibold px-4 py-2.5 rounded-full">
              <UserCog size={14} /> Assignations
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-[18px] mb-5">
        <StatCard icon={Building2} label="Établissements actifs" value={nbEtablissements ?? 0} hint="Sites rattachés" />
        <StatCard icon={Users} label="Bénéficiaires actifs" value={nbBeneficiaires ?? 0} hint="Personnes suivies" />
        <IgaDial value={igaMoyen} label="Score IGA moyen" />
        <StatCard icon={UserPlus} label="Invitations en attente" value={nbInvitationsEnAttente ?? 0} hint="Équipe et parents/tuteurs" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5 mb-5">
        <Panel title="Présences du jour" icon={CalendarCheck}>
          {(presencesJour ?? []).length === 0 ? (
            <EmptyState text="Aucune présence saisie aujourd'hui." />
          ) : (
            <div className="grid grid-cols-3 gap-3.5">
              <CommandTile label="Présents" value={String(presencesParStatut.present)} status="ok" />
              <CommandTile label="Absents" value={String(presencesParStatut.absent)} status="down" />
              <CommandTile label="Retards" value={String(presencesParStatut.retard)} status="warn" />
            </div>
          )}
        </Panel>

        <Panel title="Équipe" icon={UserCog}>
          {repartitionRoles.size === 0 ? (
            <EmptyState text="Aucun membre d'équipe pour le moment." />
          ) : (
            <ul className="divide-y divide-border-soft/60">
              {[...repartitionRoles.entries()].map(([role, total]) => (
                <li key={role} className="py-2.5 flex items-center justify-between text-[13.5px]">
                  <span className="text-text-muted">{ROLE_LABEL[role] ?? role}</span>
                  <StatusPill status="idle">{total}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

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
