import { Star, CheckCircle2, PauseCircle, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill } from '../_components/ui'
import { ModerationModal } from '../marketplace/_components/ModerationModal'
import { publierAvisAction, masquerAvisAction, retirerAvisAction } from './actions'

const STATUT_STYLE: Record<string, 'ok' | 'warn' | 'down' | 'idle'> = {
  publie: 'ok',
  en_verification: 'warn',
  masque: 'down',
  retiree: 'idle',
}
const STATUT_LABEL: Record<string, string> = {
  publie: 'Publié',
  en_verification: 'En vérification',
  masque: 'Masqué',
  retiree: 'Retiré',
}

export default async function AvisModerationPage() {
  const supabase = await createClient()
  const { data: avis } = await supabase
    .from('avis_beneficiaires')
    .select('id, note, texte, statut, declencheur, palier, created_at, organisations(nom), beneficiaires(nom, prenoms)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <>
      <PageHeader eyebrowIcon={Star} eyebrowText="Gouvernance" title="Avis bénéficiaires" subtitle="Modération des témoignages avant publication sur le profil public des formateurs." />

      <Panel title={`${avis?.length ?? 0} avis`}>
        <DataTable
          columns={['Bénéficiaire', 'Formateur', 'Note', 'Témoignage', 'Statut', 'Actions']}
          rows={(avis ?? []).map((a: any) => [
            `${a.beneficiaires?.prenoms ?? ''} ${a.beneficiaires?.nom ?? ''}`.trim() || '—',
            a.organisations?.nom ?? '—',
            `${a.note}/5`,
            a.texte ?? '—',
            <StatusPill key="s" status={STATUT_STYLE[a.statut] ?? 'idle'}>{STATUT_LABEL[a.statut] ?? a.statut}</StatusPill>,
            <div key="actions" className="flex flex-wrap gap-1.5">
              {a.statut !== 'publie' && (
                <ModerationModal
                  action={publierAvisAction.bind(null, a.id)}
                  triggerLabel="Publier"
                  triggerIcon={<CheckCircle2 size={13} />}
                  triggerClassName="flex items-center gap-1 text-[12px] border border-status-ok/40 text-status-ok rounded-lg px-2.5 py-1.5"
                  title="Publier cet avis ?"
                  message="Il deviendra visible sur le profil public du formateur (prénom + initiale uniquement)."
                  confirmLabel="Publier"
                  confirmClassName="text-[13px] font-semibold text-bg-base bg-status-ok rounded-full px-4 py-2"
                />
              )}
              {a.statut !== 'masque' && (
                <ModerationModal
                  action={masquerAvisAction.bind(null, a.id)}
                  triggerLabel="Masquer"
                  triggerIcon={<PauseCircle size={13} />}
                  triggerClassName="flex items-center gap-1 text-[12px] border border-status-warn/40 text-status-warn rounded-lg px-2.5 py-1.5"
                  title="Masquer cet avis ?"
                  message="Il redevient invisible publiquement, récupérable plus tard."
                  confirmLabel="Masquer"
                  confirmClassName="text-[13px] font-semibold text-bg-base bg-status-warn rounded-full px-4 py-2"
                />
              )}
              {a.statut !== 'retiree' && (
                <ModerationModal
                  action={retirerAvisAction.bind(null, a.id)}
                  triggerLabel="Retirer"
                  triggerIcon={<Trash2 size={13} />}
                  triggerClassName="flex items-center gap-1 text-[12px] border border-danger/40 text-danger rounded-lg px-2.5 py-1.5"
                  title="Retirer cet avis ?"
                  message="Action plus définitive que « Masquer » : l'avis disparaît de toute vue publique."
                  confirmLabel="Retirer"
                  confirmClassName="text-[13px] font-semibold text-bg-base bg-danger rounded-full px-4 py-2"
                />
              )}
            </div>,
          ])}
          emptyText="Aucun avis pour le moment."
        />
      </Panel>
    </>
  )
}
