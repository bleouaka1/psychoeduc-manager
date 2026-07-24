import { redirect } from 'next/navigation'
import { CalendarCheck, TrendingUp, HeartHandshake } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { impersonationActive } from '@/lib/apercu'
import { ImpersonationBanner } from '../(dashboard)/_components/ImpersonationBanner'
import { logout } from '../login/actions'

const TENDANCE_LABEL: Record<string, { texte: string; couleur: string }> = {
  progresse: { texte: 'Progresse', couleur: 'var(--accent-teal)' },
  stable: { texte: 'Stable', couleur: 'var(--accent-gold)' },
  en_difficulte: { texte: 'En difficulté', couleur: 'var(--danger)' },
  inconnue: { texte: 'Pas encore évalué', couleur: 'var(--text-muted)' },
}
const STATUT_PRESENCE_LABEL: Record<string, string> = { present: 'Présent', absent: 'Absent', retard: 'Retard' }

/**
 * Espace Parent (§4.3) — strictement limité aux faits bruts de présence et à une tendance
 * de progression *synthétique* (jamais un score IGA chiffré, jamais le détail par dimension,
 * jamais une fiche d'entretien — exclusion permanente et non négociable, cf. RLS/RPC dédiées
 * de la migration 20260729030000). Aucune donnée sensible n'est lue ici : la tendance vient
 * d'une fonction SECURITY DEFINER qui ne renvoie qu'une étiquette, jamais un chiffre.
 */
export default async function EspaceParentPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: liens } = await supabase
    .from('liens_parent_beneficiaire')
    .select('beneficiaire_id, beneficiaires(id, nom, prenoms, organisations(nom))')
    .eq('parent_profile_id', user.id)
    .eq('statut', 'actif')

  if (!liens || liens.length === 0) redirect('/login')

  const enImpersonation = await impersonationActive()

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const trenteJours = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const enfants = await Promise.all(
    liens.map(async (l: any) => {
      const [{ data: presences }, { data: tendance }] = await Promise.all([
        supabase
          .from('presences')
          .select('date_seance, statut, justifie')
          .eq('beneficiaire_id', l.beneficiaire_id)
          .gte('date_seance', trenteJours)
          .order('date_seance', { ascending: false })
          .limit(10),
        supabase.rpc('tendance_iga_enfant', { p_beneficiaire_id: l.beneficiaire_id }),
      ])
      return { beneficiaire: l.beneficiaires, presences: presences ?? [], tendance: (tendance as string) ?? 'inconnue' }
    }),
  )

  return (
    <div className="min-h-screen bg-bg-base relative overflow-x-hidden">
      <div className="ambient-halo" />
      <div className="relative z-[1] px-6 sm:px-10 py-7 max-w-3xl mx-auto border-b border-border-soft flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[38px] h-[38px] rounded-[9px] bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center font-display font-bold text-bg-base text-sm">
            PM
          </div>
          <p className="font-data text-[11px] tracking-[0.12em] text-text-muted uppercase">Espace Parent</p>
        </div>
        <form action={logout}>
          <button type="submit" className="text-text-muted hover:text-danger transition-colors text-[13px]">
            Déconnexion
          </button>
        </form>
      </div>

      {enImpersonation && (
        <div className="relative z-[1] px-6 sm:px-10 pt-7">
          <ImpersonationBanner />
        </div>
      )}

      <div className="relative z-[1] px-6 sm:px-10 py-11 max-w-3xl mx-auto space-y-8">
        {enfants.map(({ beneficiaire, presences, tendance }) => {
          const tendanceInfo = TENDANCE_LABEL[tendance] ?? TENDANCE_LABEL.inconnue
          return (
            <div key={beneficiaire.id} className="bg-bg-card border border-border-soft rounded-2xl p-6">
              <h2 className="font-display text-text-primary text-xl mb-1">
                {beneficiaire.prenoms} {beneficiaire.nom}
              </h2>
              <p className="text-text-muted text-[12.5px] mb-6">{beneficiaire.organisations?.nom ?? ''}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-bg-surface border border-border-soft rounded-xl p-4">
                  <p className="flex items-center gap-1.5 text-text-muted text-[11px] uppercase tracking-wide mb-2">
                    <TrendingUp size={13} /> Tendance de progression
                  </p>
                  <p className="font-display text-lg" style={{ color: tendanceInfo.couleur }}>
                    {tendanceInfo.texte}
                  </p>
                </div>
                <div className="bg-bg-surface border border-border-soft rounded-xl p-4">
                  <p className="flex items-center gap-1.5 text-text-muted text-[11px] uppercase tracking-wide mb-2">
                    <HeartHandshake size={13} /> Contact
                  </p>
                  <p className="text-text-primary text-[13px]">Pour toute question, contactez l&apos;équipe de {beneficiaire.organisations?.nom ?? "l'organisation"}.</p>
                </div>
              </div>

              <p className="flex items-center gap-1.5 text-text-muted text-[11px] uppercase tracking-wide mb-3">
                <CalendarCheck size={13} /> Présences (30 derniers jours)
              </p>
              {presences.length === 0 ? (
                <p className="text-text-muted text-sm">Aucune présence enregistrée sur cette période.</p>
              ) : (
                <ul className="divide-y divide-border-soft/60">
                  {presences.map((p: any, i: number) => (
                    <li key={i} className="py-2 flex items-center justify-between text-[13px]">
                      <span className="text-text-muted">{formatter.format(new Date(p.date_seance))}</span>
                      <span
                        className="font-medium"
                        style={{ color: p.statut === 'present' ? 'var(--accent-teal)' : p.statut === 'absent' ? 'var(--danger)' : 'var(--accent-gold)' }}
                      >
                        {STATUT_PRESENCE_LABEL[p.statut] ?? p.statut}
                        {p.justifie && p.statut !== 'present' ? ' (justifié)' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <footer className="relative z-[1] max-w-3xl mx-auto px-6 sm:px-10 pb-12 pt-6 mt-6 border-t border-border-soft text-center">
        <p className="font-data text-[10.5px] tracking-[0.1em] text-text-muted uppercase">
          <span className="text-accent-gold">PsychoÉduc Manager</span> — Espace Parent
        </p>
      </footer>
    </div>
  )
}
