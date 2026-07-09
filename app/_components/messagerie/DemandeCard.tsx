import { FileCheck2, FileClock } from 'lucide-react'
import { StatusPill } from '../../(dashboard)/_components/ui'

export function DemandeCard({ typeDocument, note, statutDemande }: { typeDocument: string | null; note: string | null; statutDemande: string | null }) {
  const recu = statutDemande === 'recu'
  return (
    <div className="border border-border-soft rounded-xl px-3.5 py-3 bg-bg-surface max-w-[85%]">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-text-primary text-[13px] font-medium flex items-center gap-1.5">
          {recu ? <FileCheck2 size={14} className="text-status-ok" /> : <FileClock size={14} className="text-status-warn" />}
          Pièce demandée : {typeDocument}
        </p>
        <StatusPill status={recu ? 'ok' : 'warn'}>{recu ? 'Reçue' : 'En attente'}</StatusPill>
      </div>
      {note && <p className="text-text-muted text-[12px]">{note}</p>}
    </div>
  )
}
