import Link from 'next/link'
import { Users, UserPlus, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill } from '../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../_lib/getSoloOrg'
import { ajouterBeneficiaire, validerDemande, refuserDemande, archiverBeneficiaire } from './actions'
import { SupprimerAvecConfirmation } from '../_components/ConfirmModal'
import { supprimerBeneficiaire } from './actions'

const SEUIL_NOUVEAU_JOURS = 30
const SEUIL_INACTIF_JOURS = 30

export default async function SoloBeneficiairesPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue = 'tout' } = await searchParams
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()
  const { data: beneficiaires } = await supabase
    .from('beneficiaires')
    .select('id, nom, prenoms, statut_beneficiaire, created_at, motif_refus')
    .eq('organisation_id', organisation.id)
    .order('created_at', { ascending: false })

  const beneficiaireIds = (beneficiaires ?? []).map((b) => b.id)
  const [{ data: scores }, { data: messages }, { data: seances }] = await Promise.all([
    beneficiaireIds.length > 0
      ? supabase.from('evaluations_iga').select('score_global, beneficiaire_id, date_evaluation').in('beneficiaire_id', beneficiaireIds).order('date_evaluation', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    beneficiaireIds.length > 0
      ? supabase.from('messages').select('destinataire_beneficiaire_id, created_at').in('destinataire_beneficiaire_id', beneficiaireIds)
      : Promise.resolve({ data: [] as any[] }),
    beneficiaireIds.length > 0
      ? supabase.from('seances').select('beneficiaire_id, date_heure').in('beneficiaire_id', beneficiaireIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const derniereEvalParBeneficiaire = new Map<string, any>()
  for (const s of scores ?? []) if (!derniereEvalParBeneficiaire.has(s.beneficiaire_id)) derniereEvalParBeneficiaire.set(s.beneficiaire_id, s)

  const derniereActiviteParBeneficiaire = new Map<string, number>()
  const noter = (id: string, t: number) => derniereActiviteParBeneficiaire.set(id, Math.max(derniereActiviteParBeneficiaire.get(id) ?? 0, t))
  for (const s of scores ?? []) noter(s.beneficiaire_id, new Date(s.date_evaluation).getTime())
  for (const m of messages ?? []) if (m.destinataire_beneficiaire_id) noter(m.destinataire_beneficiaire_id, new Date(m.created_at).getTime())
  for (const s of seances ?? []) if (s.beneficiaire_id) noter(s.beneficiaire_id, new Date(s.date_heure).getTime())

  const maintenant = Date.now()
  const seuilNouveauMs = maintenant - SEUIL_NOUVEAU_JOURS * 24 * 60 * 60 * 1000
  const seuilInactifMs = maintenant - SEUIL_INACTIF_JOURS * 24 * 60 * 60 * 1000

  function classifier(b: any): 'en_attente' | 'refuse' | 'archive' | 'nouveau' | 'suivi_actif' | 'inactif' {
    if (b.statut_beneficiaire === 'en_attente') return 'en_attente'
    if (b.statut_beneficiaire === 'refuse') return 'refuse'
    if (b.statut_beneficiaire === 'archive') return 'archive'
    const derniereActivite = derniereActiviteParBeneficiaire.get(b.id) ?? 0
    if (derniereActivite < seuilInactifMs && new Date(b.created_at).getTime() < seuilNouveauMs) return 'inactif'
    if (derniereEvalParBeneficiaire.has(b.id)) return 'suivi_actif'
    if (new Date(b.created_at).getTime() >= seuilNouveauMs) return 'nouveau'
    return 'suivi_actif'
  }

  const beneficiairesClasses = (beneficiaires ?? []).map((b: any) => ({ ...b, classification: classifier(b) }))
  const demandes = beneficiairesClasses.filter((b) => b.classification === 'en_attente')
  const visibles = vue === 'tout' ? beneficiairesClasses.filter((b) => b.classification !== 'en_attente') : beneficiairesClasses.filter((b) => b.classification === vue)

  const ONGLETS: { valeur: string; label: string }[] = [
    { valeur: 'tout', label: 'Tout' },
    { valeur: 'nouveau', label: 'Nouveaux' },
    { valeur: 'suivi_actif', label: 'Suivi actif' },
    { valeur: 'inactif', label: 'Inactifs' },
    { valeur: 'archive', label: 'Archivés' },
    { valeur: 'refuse', label: 'Refusés' },
  ]

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={Users} eyebrowText="Mon espace Solo" title="Mes bénéficiaires" subtitle="Suivi personnel de vos bénéficiaires et de leur progression IGA." />

      <Panel title="Ajouter un bénéficiaire" className="mb-6">
        <form action={ajouterBeneficiaire} className="flex flex-wrap items-center gap-2.5">
          <input name="nom" required placeholder="Nom" className="flex-1 min-w-[160px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
          <input name="prenoms" required placeholder="Prénoms" className="flex-1 min-w-[160px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
          <label className="flex items-center gap-1.5 text-[12px] text-text-muted">
            <input type="checkbox" name="comme_demande" className="accent-current" /> Soumettre comme demande (à valider)
          </label>
          <button type="submit" className="flex items-center gap-1.5 bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
            <UserPlus size={14} /> Ajouter
          </button>
        </form>
      </Panel>

      {demandes.length > 0 && (
        <Panel title={`${demandes.length} demande(s) en attente`} icon={Clock} className="mb-6">
          <div className="divide-y divide-border-soft">
            {demandes.map((b: any) => (
              <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-text-primary text-[13.5px]">
                  {b.nom} {b.prenoms} <span className="text-text-muted text-[11px]">— demande du {formatter.format(new Date(b.created_at))}</span>
                </p>
                <div className="flex items-center gap-2">
                  <form action={validerDemande.bind(null, b.id)}>
                    <button type="submit" className="flex items-center gap-1 text-[11.5px] text-accent-teal border border-accent-teal-dim/50 rounded-full px-3 py-1.5">
                      <CheckCircle2 size={12} /> Valider
                    </button>
                  </form>
                  <form action={refuserDemande.bind(null, b.id)} className="flex items-center gap-1.5">
                    <input name="motif" placeholder="Motif (optionnel)" className="bg-bg-surface border border-border-soft rounded-lg px-2 py-1.5 text-[11.5px] text-text-primary outline-none w-40" />
                    <button type="submit" className="flex items-center gap-1 text-[11.5px] text-danger border border-danger/40 rounded-full px-3 py-1.5">
                      <XCircle size={12} /> Refuser
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {ONGLETS.map((o) => (
          <Link
            key={o.valeur}
            href={`/solo/beneficiaires?vue=${o.valeur}`}
            className={`text-[12.5px] px-3.5 py-1.5 rounded-full border ${vue === o.valeur ? 'bg-accent-gold text-bg-base border-accent-gold font-semibold' : 'border-border-soft text-text-muted hover:text-text-primary'}`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      <Panel title={`${visibles.length} bénéficiaire(s)`}>
        {visibles.length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">Aucun bénéficiaire dans cette vue.</p>
        ) : (
          <div className="divide-y divide-border-soft">
            {visibles.map((b: any) => {
              const eval_ = derniereEvalParBeneficiaire.get(b.id)
              return (
                <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/solo/beneficiaires/${b.id}`} className="text-accent-gold hover:underline text-[13.5px] font-medium">
                      {b.nom} {b.prenoms}
                    </Link>
                    <p className="text-text-muted text-[11px] mt-0.5">
                      IGA : {eval_?.score_global ?? '—'} · {b.motif_refus ? `Motif : ${b.motif_refus}` : formatter.format(new Date(b.created_at))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <StatusPill status={b.classification === 'suivi_actif' ? 'ok' : b.classification === 'inactif' || b.classification === 'refuse' ? 'down' : 'idle'}>
                      {{ nouveau: 'Nouveau', suivi_actif: 'Suivi actif', inactif: 'Inactif', archive: 'Archivé', refuse: 'Refusé', en_attente: 'En attente' }[b.classification as string]}
                    </StatusPill>
                    {b.classification !== 'archive' && (
                      <form action={archiverBeneficiaire.bind(null, b.id)}>
                        <button type="submit" className="text-[11px] text-text-muted border border-border-soft rounded-full px-2.5 py-1">
                          Archiver
                        </button>
                      </form>
                    )}
                    <SupprimerAvecConfirmation
                      action={supprimerBeneficiaire.bind(null, b.id)}
                      label="Supprimer"
                      titreConfirmation="Supprimer ce bénéficiaire ?"
                      messageConfirmation="Cette action est définitive. Aucun historique n'a été détecté pour ce bénéficiaire."
                      bloque={false}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </>
  )
}
