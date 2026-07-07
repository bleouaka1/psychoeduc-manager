import Link from 'next/link'
import { UserRound, Target, MessageCircle, FileText, CheckCircle2, Circle, CircleDot, Activity, AlertTriangle, CalendarClock, Gauge, NotebookPen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatusPill, IgaDial } from '../../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../../_lib/getSoloOrg'
import { ajouterObjectif, avancerObjectif, envoyerMessageBeneficiaire } from './actions'
import { creerEntretien } from './entretiens/actions'
import { chargerContactsBeneficiaire } from '@/lib/messagerieDirecteServer'
import { EnvoyerMessageModal } from '../../_components/EnvoyerMessageModal'

const TYPE_ENTRETIEN_LABEL: Record<string, string> = { general: 'Général', specialise: 'Spécialisé' }

const STATUT_OBJECTIF_ICON: Record<string, any> = {
  a_venir: Circle,
  en_cours: CircleDot,
  atteint: CheckCircle2,
}
const STATUT_OBJECTIF_LABEL: Record<string, string> = {
  a_venir: 'À venir',
  en_cours: 'En cours',
  atteint: 'Atteint',
}
const PROCHAINE_ACTION: Record<string, string> = {
  a_venir: 'Démarrer',
  en_cours: 'Marquer atteint',
}
const STATUT_BENEFICIAIRE_LABEL: Record<string, string> = {
  actif: 'Actif',
  inactif: 'Inactif',
  suspendu: 'Suspendu',
  sorti: 'Sorti',
  archive: 'Archivé',
  en_attente: 'En attente de validation',
  refuse: 'Refusé',
}
const TYPE_MESSAGE_LABEL: Record<string, string> = { suivi: 'Suivi', entretien: 'Entretien', signalement: 'Signalement' }

export default async function FicheBeneficiairePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()

  const [{ data: beneficiaire }, { data: evaluations }, { data: objectifs }, { data: messages }, { data: entretiens }] = await Promise.all([
    supabase.from('beneficiaires').select('id, nom, prenoms, statut_beneficiaire, created_at').eq('id', id).eq('organisation_id', organisation.id).single(),
    supabase.from('evaluations_iga').select('score_global, niveau, date_evaluation').eq('beneficiaire_id', id).order('date_evaluation', { ascending: false }),
    supabase.from('objectifs_beneficiaire').select('id, titre, description, statut, date_cible, atteint_le').eq('beneficiaire_id', id).order('ordre').order('created_at'),
    supabase.from('messages').select('id, contenu, created_at, type_message').eq('destinataire_beneficiaire_id', id).order('created_at', { ascending: false }).limit(40),
    supabase.from('entretiens').select('id, type_entretien, statut, date_entretien, created_at').eq('beneficiaire_id', id).order('created_at', { ascending: false }),
  ])

  if (!beneficiaire) return null

  const contacts = await chargerContactsBeneficiaire(id)

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const derniereEval = evaluations?.[0]

  // Fil chronologique unifié : évaluations IGA + messages + entretiens VALIDÉS uniquement
  // (un brouillon n'est pas encore un événement du parcours, cf. spec §0/§2).
  const fil = [
    ...(evaluations ?? []).map((e: any) => ({ type: 'evaluation' as const, date: e.date_evaluation, data: e })),
    ...(messages ?? []).map((m: any) => ({ type: 'message' as const, date: m.created_at, data: m })),
    ...(entretiens ?? []).filter((e: any) => e.statut === 'valide').map((e: any) => ({ type: 'entretien' as const, date: e.date_entretien, data: e })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <>
      <PageHeader
        eyebrowIcon={UserRound}
        eyebrowText="Mon espace Solo"
        title={`${beneficiaire.nom} ${beneficiaire.prenoms}`}
        subtitle="Feuille de route, échanges et historique IGA de ce bénéficiaire."
        actions={
          <div className="flex items-center gap-2.5">
            <EnvoyerMessageModal
              beneficiaire={contacts.beneficiaire}
              parentsTuteurs={contacts.parentsTuteurs}
              formateursResponsables={contacts.formateursResponsables}
              modeWhatsApp={organisation.mode_whatsapp_defaut}
            />
            <Link
              href={`/solo/beneficiaires/${id}/rapport`}
              target="_blank"
              className="flex items-center gap-1.5 bg-bg-card border border-border-soft text-text-primary text-[13px] font-medium px-4 py-2.5 rounded-full"
            >
              <FileText size={14} /> Rapport de bilan
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <IgaDial value={derniereEval?.score_global ?? null} label="Dernier score IGA" />
        <Panel title="Statut">
          <StatusPill status={beneficiaire.statut_beneficiaire === 'actif' ? 'ok' : beneficiaire.statut_beneficiaire === 'refuse' ? 'down' : 'idle'}>
            {STATUT_BENEFICIAIRE_LABEL[beneficiaire.statut_beneficiaire] ?? beneficiaire.statut_beneficiaire}
          </StatusPill>
          <p className="text-text-muted text-xs mt-3">Suivi depuis le {formatter.format(new Date(beneficiaire.created_at))}</p>
        </Panel>
        <Panel title="Historique IGA">
          {(evaluations ?? []).length === 0 ? (
            <p className="text-text-muted text-xs">Aucune évaluation enregistrée.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {(evaluations ?? []).slice(0, 4).map((e: any, i: number) => (
                <li key={i} className="flex justify-between text-text-muted">
                  <span>{formatter.format(new Date(e.date_evaluation))}</span>
                  <span className="font-data text-text-primary">{e.score_global ?? '—'}/100</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Objectifs & jalons" icon={Target} className="mb-6">
        <form action={ajouterObjectif.bind(null, id)} className="flex flex-wrap gap-2.5 mb-5">
          <input
            name="titre"
            required
            placeholder="Nouvel objectif (ex. Trouver un stage)"
            className="flex-1 min-w-[220px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
          />
          <input name="date_cible" type="date" className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
          <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
            Ajouter
          </button>
        </form>

        {(objectifs ?? []).length === 0 ? (
          <p className="text-text-muted text-sm py-4 text-center">Aucun jalon défini pour le moment.</p>
        ) : (
          <ul className="space-y-2.5">
            {(objectifs ?? []).map((o: any) => {
              const Icon = STATUT_OBJECTIF_ICON[o.statut] ?? Circle
              return (
                <li key={o.id} className="flex items-center justify-between gap-3 bg-bg-surface border border-border-soft rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className={o.statut === 'atteint' ? 'text-accent-teal' : o.statut === 'en_cours' ? 'text-accent-gold' : 'text-text-muted'} />
                    <div>
                      <p className="text-text-primary text-[13.5px] font-medium">{o.titre}</p>
                      {o.date_cible && <p className="text-text-muted text-[11px]">Échéance : {formatter.format(new Date(o.date_cible))}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <StatusPill status={o.statut === 'atteint' ? 'ok' : o.statut === 'en_cours' ? 'warn' : 'idle'}>{STATUT_OBJECTIF_LABEL[o.statut]}</StatusPill>
                    {PROCHAINE_ACTION[o.statut] && (
                      <form action={avancerObjectif.bind(null, id, o.id, o.statut)}>
                        <button type="submit" className="text-[11.5px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-3 py-1">
                          {PROCHAINE_ACTION[o.statut]}
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Entretiens" icon={NotebookPen} className="mb-6">
        <form action={creerEntretien.bind(null, id)} className="flex flex-wrap gap-2.5 mb-5">
          <button
            type="submit"
            name="type_entretien"
            value="general"
            className="flex items-center gap-1.5 bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full"
          >
            <NotebookPen size={14} /> Créer un entretien général
          </button>
          <button
            type="submit"
            name="type_entretien"
            value="specialise"
            className="flex items-center gap-1.5 bg-bg-surface border border-border-soft text-text-primary font-semibold text-[13px] px-4 py-2 rounded-full"
          >
            <NotebookPen size={14} /> Créer un entretien spécialisé
          </button>
        </form>

        {(entretiens ?? []).length === 0 ? (
          <p className="text-text-muted text-sm py-2 text-center">Aucun entretien pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {(entretiens ?? []).map((e: any) => (
              <li key={e.id} className="flex items-center justify-between gap-3 bg-bg-surface border border-border-soft rounded-xl px-4 py-2.5">
                <Link href={`/solo/beneficiaires/${id}/entretiens/${e.id}`} className="text-accent-gold hover:underline text-[13px]">
                  Entretien {TYPE_ENTRETIEN_LABEL[e.type_entretien] ?? e.type_entretien} — {formatter.format(new Date(e.date_entretien))}
                </Link>
                <StatusPill status={e.statut === 'valide' ? 'ok' : 'idle'}>{e.statut === 'valide' ? 'Validé' : 'Brouillon'}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Messagerie" icon={MessageCircle} className="mb-6">
        <form action={envoyerMessageBeneficiaire.bind(null, id)} className="flex flex-wrap gap-2.5 mb-5">
          <select name="type_message" defaultValue="suivi" className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary">
            <option value="suivi">Suivi général (visible du bénéficiaire)</option>
            <option value="entretien">Entretien (visible du bénéficiaire)</option>
            <option value="signalement">Signalement (jamais visible du bénéficiaire)</option>
          </select>
          <input
            name="contenu"
            required
            placeholder="Écrire un message…"
            className="flex-1 min-w-[220px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
          />
          <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
            Envoyer
          </button>
        </form>
        <p className="text-text-muted text-[11px]">
          <AlertTriangle size={11} className="inline -mt-0.5 mr-1 text-danger" />
          Un signalement n'est jamais visible par le bénéficiaire concerné, quel que soit son accès.
        </p>
      </Panel>

      <Panel title="Fil chronologique" icon={Activity}>
        {fil.length === 0 ? (
          <p className="text-text-muted text-sm py-4 text-center">Aucun événement enregistré pour le moment.</p>
        ) : (
          <ul className="space-y-2.5">
            {fil.map((evt, i) => {
              if (evt.type === 'evaluation') {
                const e = evt.data
                return (
                  <li key={`e-${i}`} className="flex items-start gap-2.5 bg-bg-surface border border-border-soft rounded-xl px-4 py-3">
                    <Gauge size={15} className="text-accent-teal mt-0.5" />
                    <div className="flex-1">
                      <p className="text-text-primary text-[13px]">Évaluation IGA — {e.score_global ?? '—'}/100 {e.niveau ? `(${e.niveau})` : ''}</p>
                      <p className="text-text-muted text-[10.5px] mt-0.5">{formatter.format(new Date(e.date_evaluation))}</p>
                    </div>
                  </li>
                )
              }
              if (evt.type === 'entretien') {
                const e = evt.data
                return (
                  <li key={`ent-${i}`} className="flex items-start gap-2.5 bg-bg-surface border border-border-soft rounded-xl px-4 py-3">
                    <NotebookPen size={15} className="text-accent-gold mt-0.5" />
                    <div className="flex-1">
                      <p className="text-text-primary text-[13px]">
                        Entretien {TYPE_ENTRETIEN_LABEL[e.type_entretien] ?? e.type_entretien} validé —{' '}
                        <Link href={`/solo/beneficiaires/${id}/entretiens/${e.id}`} className="text-accent-gold hover:underline">
                          consulter
                        </Link>
                      </p>
                      <p className="text-text-muted text-[10.5px] mt-0.5">{formatter.format(new Date(e.date_entretien))}</p>
                    </div>
                  </li>
                )
              }
              const m = evt.data
              const estSignalement = m.type_message === 'signalement'
              return (
                <li
                  key={`m-${i}`}
                  className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border ${estSignalement ? 'bg-danger/5 border-danger/30' : 'bg-bg-surface border-border-soft'}`}
                >
                  {estSignalement ? <AlertTriangle size={15} className="text-danger mt-0.5" /> : m.type_message === 'entretien' ? <CalendarClock size={15} className="text-accent-gold mt-0.5" /> : <MessageCircle size={15} className="text-text-muted mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold mb-0.5" style={{ color: estSignalement ? 'var(--danger)' : undefined }}>
                      {TYPE_MESSAGE_LABEL[m.type_message] ?? m.type_message}
                    </p>
                    <p className="text-text-primary text-[13px]">{m.contenu}</p>
                    <p className="text-text-muted text-[10.5px] mt-1">{formatter.format(new Date(m.created_at))}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </>
  )
}
