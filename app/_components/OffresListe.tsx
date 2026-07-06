import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { StatusPill } from '../(dashboard)/_components/ui'
import { SupprimerAvecConfirmation } from '../solo/_components/ConfirmModal'

const STATUT_LABEL: Record<string, string> = {
  en_attente_validation: 'En attente de validation',
  publiee: 'Publiée',
  refusee: 'Refusée',
  masquee: 'Masquée',
  retiree: 'Retirée',
}
const STATUT_PILL: Record<string, 'ok' | 'warn' | 'down' | 'idle'> = {
  en_attente_validation: 'warn',
  publiee: 'ok',
  refusee: 'down',
  masquee: 'down',
  retiree: 'idle',
}

/** Liste "Mes offres" partagée entre le module Compte Solo et le module Employeur. */
export function OffresListe({
  offres,
  editHrefBase,
  retirerAction,
  supprimerAction,
}: {
  offres: { id: string; titre: string; type_offre: string; prix: number | null; statut: string }[]
  editHrefBase: string
  retirerAction: (offreId: string) => Promise<void>
  supprimerAction: (offreId: string) => Promise<{ error: string | null }>
}) {
  if (offres.length === 0) return <p className="text-text-muted text-sm py-4 text-center">Aucune offre publiée pour le moment.</p>

  return (
    <div className="divide-y divide-border-soft">
      {offres.map((o) => (
        <div key={o.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-text-primary text-[13px]">{o.titre}</p>
            <p className="text-text-muted text-[11px]">
              {o.type_offre} — {o.prix != null ? `${o.prix} FCFA` : '—'}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <StatusPill status={STATUT_PILL[o.statut] ?? 'idle'}>{STATUT_LABEL[o.statut] ?? o.statut}</StatusPill>
            <Link href={`${editHrefBase}?edit=${o.id}`} className="flex items-center gap-1 text-[11.5px] text-text-muted border border-border-soft rounded-full px-3 py-1">
              <Pencil size={11} /> Modifier
            </Link>
            {o.statut !== 'retiree' && (
              <form action={retirerAction.bind(null, o.id)}>
                <button type="submit" className="text-[11.5px] text-danger border border-danger/40 rounded-full px-3 py-1">
                  Retirer
                </button>
              </form>
            )}
            <SupprimerAvecConfirmation
              action={supprimerAction.bind(null, o.id)}
              label="Supprimer"
              titreConfirmation="Supprimer cette offre ?"
              messageConfirmation="Cette action est définitive, différente de « Retirer ». Impossible si des commandes existent déjà."
              bloque={false}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
