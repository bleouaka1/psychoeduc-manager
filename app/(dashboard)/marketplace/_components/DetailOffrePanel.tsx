import Link from 'next/link'
import { X, MessageSquare } from 'lucide-react'
import { Panel, StatusPill } from '../../_components/ui'
import { STATUT_STYLE, STATUT_LABEL, VENDEUR_TYPE_LABEL } from '../_lib/statuts'
import { MessageThread, type MessageAffiche } from './MessageThread'

export function DetailOffrePanel({
  offre,
  closeHref,
  messages,
  envoyerMessage,
  peutEnvoyerMessage,
}: {
  offre: {
    titre: string
    description: string | null
    prix: number | null
    devise: string
    statut: string
    type_offre: string | null
    created_at: string
    organisation_nom: string | null
    organisation_type: string | null
    vendeur_bio: string | null
    vendeur_specialites: string[]
  }
  closeHref: string
  messages: MessageAffiche[]
  envoyerMessage: (contenu: string) => Promise<{ error: string | null }>
  peutEnvoyerMessage: boolean
}) {
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <Panel className="mb-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-accent-gold text-[12px] font-semibold tracking-wide mb-1">DÉTAIL DE L&apos;OFFRE</p>
          <h3 className="font-display text-xl text-text-primary">{offre.titre}</h3>
        </div>
        <Link href={closeHref} className="text-text-muted hover:text-text-primary p-1.5" aria-label="Fermer">
          <X size={18} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6">
        <div>
          <p className="text-xs text-text-muted mb-1">Statut</p>
          <StatusPill status={STATUT_STYLE[offre.statut] ?? 'idle'}>{STATUT_LABEL[offre.statut] ?? offre.statut}</StatusPill>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">Type d&apos;offre</p>
          <p className="text-[13.5px] text-text-primary">{offre.type_offre ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">Prix</p>
          <p className="text-[13.5px] text-text-primary font-data">{offre.prix != null ? `${offre.prix} ${offre.devise}` : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">Date de création</p>
          <p className="text-[13.5px] text-text-primary">{formatter.format(new Date(offre.created_at))}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-text-muted mb-1">Description</p>
          <p className="text-[13.5px] text-text-primary whitespace-pre-wrap">{offre.description || '—'}</p>
        </div>
      </div>

      <div className="border-t border-border-soft pt-5 mb-6">
        <p className="text-xs text-text-muted mb-2">Vendeur</p>
        <p className="text-[13.5px] text-text-primary font-medium mb-1">
          {offre.organisation_nom ?? '—'} <span className="text-text-muted font-normal">({VENDEUR_TYPE_LABEL[offre.organisation_type ?? ''] ?? offre.organisation_type ?? '—'})</span>
        </p>
        {offre.vendeur_bio && <p className="text-[13px] text-text-muted mb-2">{offre.vendeur_bio}</p>}
        {offre.vendeur_specialites.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {offre.vendeur_specialites.map((s) => (
              <span key={s} className="text-[11.5px] text-text-muted border border-border-soft rounded-full px-2.5 py-1">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border-soft pt-5">
        <h4 className="font-display text-[15px] text-text-primary mb-3 flex items-center gap-2">
          <MessageSquare size={15} className="text-accent-gold" /> Messages échangés au sujet de cette offre
        </h4>
        {peutEnvoyerMessage ? (
          <MessageThread messages={messages} action={envoyerMessage} />
        ) : messages.length === 0 ? (
          <p className="text-text-muted text-sm py-4 text-center">Aucun message pour cette offre pour le moment.</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="rounded-xl px-3.5 py-2.5 text-[13px] bg-bg-surface border border-border-soft">
                <p className="text-text-primary whitespace-pre-wrap">{m.contenu}</p>
                <p className="text-text-muted text-[11px] mt-1.5">{m.auteur}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
