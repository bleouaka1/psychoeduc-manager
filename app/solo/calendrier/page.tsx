import { CalendarClock, Video, Users2, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatusPill } from '../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../_lib/getSoloOrg'
import { creerSeance, annulerSeance, terminerSeance } from './actions'

const STATUT_PILL: Record<string, 'ok' | 'warn' | 'down' | 'idle'> = {
  planifiee: 'warn',
  terminee: 'ok',
  annulee: 'down',
}

export default async function CalendrierPage() {
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()

  // Rappels : calcul paresseux à l'ouverture de la page (pas de tâche planifiée dans ce projet à ce jour).
  await supabase.rpc('verifier_rappels_seances', { p_organisation_id: organisation.id })

  const [{ data: seances }, { data: beneficiaires }, { data: formations }] = await Promise.all([
    supabase
      .from('seances')
      .select('id, titre, type_seance, date_heure, statut, beneficiaires(nom, prenoms), formations(titre)')
      .eq('organisation_id', organisation.id)
      .order('date_heure', { ascending: true }),
    supabase.from('beneficiaires').select('id, nom, prenoms').eq('organisation_id', organisation.id).order('nom'),
    supabase.from('formations').select('id, titre').eq('organisation_id', organisation.id).order('titre'),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const maintenant = Date.now()
  const aVenir = (seances ?? []).filter((s: any) => s.statut === 'planifiee' && new Date(s.date_heure).getTime() >= maintenant)
  const passees = (seances ?? []).filter((s: any) => s.statut !== 'planifiee' || new Date(s.date_heure).getTime() < maintenant)

  return (
    <>
      <PageHeader eyebrowIcon={CalendarClock} eyebrowText="Mon espace Solo" title="Calendrier" subtitle="Rendez-vous de suivi et sessions live de formation." />

      <Panel title="Planifier une séance" className="mb-6">
        <form action={creerSeance} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-text-muted text-xs mb-1 block">Titre</label>
            <input name="titre" required className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Type</label>
            <select name="type_seance" required className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim">
              <option value="suivi">Rendez-vous de suivi (bénéficiaire)</option>
              <option value="session_live">Session live (formation)</option>
            </select>
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Date et heure</label>
            <input
              name="date_heure"
              type="datetime-local"
              required
              className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
            />
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Bénéficiaire concerné (si suivi)</label>
            <select name="beneficiaire_id" className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim">
              <option value="">— Aucun —</option>
              {(beneficiaires ?? []).map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.nom} {b.prenoms}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-text-muted text-xs mb-1 block">Formation concernée (si session live)</label>
            <select name="formation_id" className="w-full bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim">
              <option value="">— Aucune —</option>
              {(formations ?? []).map((f: any) => (
                <option key={f.id} value={f.id}>
                  {f.titre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
              Planifier
            </button>
          </div>
        </form>
      </Panel>

      <Panel title={`${aVenir.length} séance(s) à venir`} className="mb-6">
        {aVenir.length === 0 ? (
          <p className="text-text-muted text-sm py-4 text-center">Aucune séance planifiée pour le moment.</p>
        ) : (
          <div className="divide-y divide-border-soft">
            {aVenir.map((s: any) => (
              <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {s.type_seance === 'session_live' ? <Video size={15} className="text-accent-teal" /> : <Users2 size={15} className="text-accent-gold" />}
                  <div>
                    <p className="text-text-primary text-[13.5px] font-medium">{s.titre}</p>
                    <p className="text-text-muted text-[11px]">
                      {formatter.format(new Date(s.date_heure))}
                      {s.beneficiaires && ` — ${s.beneficiaires.nom} ${s.beneficiaires.prenoms}`}
                      {s.formations && ` — ${s.formations.titre}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <form action={terminerSeance.bind(null, s.id)}>
                    <button type="submit" className="flex items-center gap-1 text-[11.5px] text-accent-teal border border-accent-teal-dim/50 rounded-full px-3 py-1.5">
                      <CheckCircle2 size={12} /> Terminée
                    </button>
                  </form>
                  <form action={annulerSeance.bind(null, s.id)}>
                    <button type="submit" className="flex items-center gap-1 text-[11.5px] text-danger border border-danger/40 rounded-full px-3 py-1.5">
                      <XCircle size={12} /> Annuler
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Historique">
        {passees.length === 0 ? (
          <p className="text-text-muted text-sm py-4 text-center">Aucun historique pour le moment.</p>
        ) : (
          <div className="divide-y divide-border-soft">
            {passees.map((s: any) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-text-primary text-[13px]">{s.titre}</p>
                  <p className="text-text-muted text-[11px]">{formatter.format(new Date(s.date_heure))}</p>
                </div>
                <StatusPill status={STATUT_PILL[s.statut] ?? 'idle'}>{s.statut}</StatusPill>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  )
}
