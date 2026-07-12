import Link from 'next/link'
import { Users2, ArrowLeft, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatusPill } from '../../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../../_lib/getSoloOrg'
import { chargerMembresCercle } from '@/lib/cerclesApprentissageServer'
import { genererAlerteDecrochage } from '@/lib/cerclesApprentissage'
import { inviterMembreAction, envoyerMessageCercleAction } from '../actions'

export default async function CercleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()
  const { data: cercle } = await supabase.from('cercles_apprentissage').select('id, nom, description, charte, reserve_adultes, conversation_id').eq('id', id).eq('organisation_id', organisation.id).single()
  if (!cercle) return null

  const [membres, { data: beneficiairesDisponibles }, { data: messages }] = await Promise.all([
    chargerMembresCercle(supabase, id, cercle.conversation_id),
    supabase.from('beneficiaires').select('id, nom, prenoms').eq('organisation_id', organisation.id),
    cercle.conversation_id
      ? supabase.from('messages').select('id, contenu, expediteur_id, created_at, profiles!expediteur_id(nom, prenoms)').eq('conversation_id', cercle.conversation_id).order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
  ])

  const idsMembres = new Set(membres.map((m) => m.beneficiaireId))
  const beneficiairesInvitables = (beneficiairesDisponibles ?? []).filter((b: any) => !idsMembres.has(b.id))
  const membresEnDecrochage = membres.filter((m) => m.enDecrochage)
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader
        eyebrowIcon={Users2}
        eyebrowText="Mon espace Solo"
        title={cercle.nom}
        subtitle={cercle.description ?? ''}
        actions={
          <Link href="/solo/cercles" className="flex items-center gap-1.5 bg-bg-card border border-border-soft text-text-primary text-[13px] font-medium px-4 py-2.5 rounded-full">
            <ArrowLeft size={14} /> Retour
          </Link>
        }
      />

      {membresEnDecrochage.length > 0 && (
        <Panel title="Décrochage silencieux" icon={AlertTriangle} className="mb-6">
          <ul className="space-y-3">
            {membresEnDecrochage.map((m) => (
              <li key={m.id} className="text-[13px] text-text-primary bg-bg-surface border border-status-warn/40 rounded-xl px-4 py-3">
                {genererAlerteDecrochage(m.prenoms, 12)}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Membres" className="mb-6">
        <form action={inviterMembreAction.bind(null, id)} className="flex flex-wrap gap-2.5 mb-4">
          <select name="beneficiaireId" required className="flex-1 min-w-[200px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim">
            <option value="">Inviter un bénéficiaire…</option>
            {beneficiairesInvitables.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.nom} {b.prenoms}
              </option>
            ))}
          </select>
          <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
            Inviter
          </button>
        </form>
        {membres.length === 0 ? (
          <p className="text-text-muted text-sm py-2 text-center">Aucun membre pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {membres.map((m) => (
              <li key={m.id} className="flex items-center justify-between bg-bg-surface border border-border-soft rounded-xl px-4 py-2.5">
                <span className="text-text-primary text-[13px]">
                  {m.nom} {m.prenoms}
                </span>
                <StatusPill status={m.statut === 'actif' ? 'ok' : m.statut === 'sorti' ? 'idle' : 'warn'}>
                  {m.statut === 'actif' ? 'Actif' : m.statut === 'sorti' ? 'Sorti' : 'Invitation envoyée'}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {cercle.conversation_id && (
        <Panel title="Discussion de groupe">
          <ul className="space-y-2.5 mb-4 max-h-96 overflow-y-auto">
            {(messages ?? []).length === 0 ? (
              <p className="text-text-muted text-sm py-4 text-center">Aucun message pour l'instant.</p>
            ) : (
              (messages ?? []).map((m: any) => (
                <li key={m.id} className="bg-bg-surface border border-border-soft rounded-xl px-3.5 py-2.5">
                  <p className="text-text-muted text-[11px] mb-0.5">
                    {m.profiles?.prenoms ?? ''} {m.profiles?.nom ?? ''} — {formatter.format(new Date(m.created_at))}
                  </p>
                  <p className="text-text-primary text-[13px]">{m.contenu}</p>
                </li>
              ))
            )}
          </ul>
          <form action={envoyerMessageCercleAction.bind(null, id, cercle.conversation_id, organisation.id)} className="flex gap-2.5">
            <input name="contenu" required placeholder="Écrire au cercle…" className="flex-1 bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
            <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
              Envoyer
            </button>
          </form>
        </Panel>
      )}
    </>
  )
}
