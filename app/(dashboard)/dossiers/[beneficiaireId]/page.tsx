import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FolderCheck, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, EmptyState, StatusPill } from '../../_components/ui'
import { getMonOrganisation } from '../../_lib/getMonOrganisation'
import { ajouterPieceRequise, mettreAJourStatutPiece } from '../actions'

const STATUT_LABEL: Record<string, string> = { manquant: 'Manquant', recu: 'Reçu', valide: 'Validé' }
const STATUT_PILL: Record<string, 'ok' | 'warn' | 'down'> = { manquant: 'down', recu: 'warn', valide: 'ok' }

const PIECES_SUGGEREES = ['Acte de naissance', 'Photo d’identité', 'Fiche d’inscription', 'Autorisation parentale', 'Certificat médical', 'Bulletin précédent']

export default async function DossierBeneficiairePage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const organisation = await getMonOrganisation()
  if (!organisation) {
    return (
      <>
        <PageHeader eyebrowIcon={FolderCheck} eyebrowText="Gestion Administrative" title="Dossier" />
        <Panel>
          <EmptyState text="Aucune organisation Structure rattachée à ce compte." />
        </Panel>
      </>
    )
  }

  const supabase = await createClient()
  const { data: beneficiaire } = await supabase.from('beneficiaires').select('id, nom, prenoms').eq('id', beneficiaireId).eq('organisation_id', organisation.id).single()
  if (!beneficiaire) notFound()

  const { data: pieces } = await supabase
    .from('documents_beneficiaires')
    .select('id, type_document, statut, created_at')
    .eq('beneficiaire_id', beneficiaireId)
    .order('created_at')

  const peutGerer = organisation.roles.some((r) => ['directeur', 'coordinateur', 'promoteur', 'administrateur', 'formateur'].includes(r))
  const typesDejaDeclares = new Set((pieces ?? []).map((p) => p.type_document))
  const suggestionsRestantes = PIECES_SUGGEREES.filter((t) => !typesDejaDeclares.has(t))

  return (
    <>
      <PageHeader
        eyebrowIcon={FolderCheck}
        eyebrowText="Gestion Administrative"
        title={`Dossier — ${beneficiaire.nom} ${beneficiaire.prenoms}`}
        subtitle="Checklist des pièces administratives."
        actions={
          <Link href="/dossiers" className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary">
            <ArrowLeft size={14} /> Retour
          </Link>
        }
      />

      <Panel title="Pièces" className="mb-6">
        {!pieces || pieces.length === 0 ? (
          <EmptyState text="Aucune pièce déclarée pour ce dossier." />
        ) : (
          <ul className="divide-y divide-border-soft/60">
            {pieces.map((p) => (
              <li key={p.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-text-primary text-[13.5px]">{p.type_document}</span>
                {peutGerer ? (
                  <div className="flex gap-2">
                    {(['manquant', 'recu', 'valide'] as const).map((s) => (
                      <form key={s} action={mettreAJourStatutPiece.bind(null, beneficiaireId, p.id, s)}>
                        <button
                          type="submit"
                          className={`text-[11.5px] px-3 py-1.5 rounded-full border ${
                            p.statut === s
                              ? s === 'valide'
                                ? 'bg-accent-teal text-bg-base border-accent-teal'
                                : s === 'manquant'
                                  ? 'bg-danger text-white border-danger'
                                  : 'bg-accent-gold text-bg-base border-accent-gold'
                              : 'border-border-soft text-text-muted hover:text-text-primary'
                          }`}
                        >
                          {STATUT_LABEL[s]}
                        </button>
                      </form>
                    ))}
                  </div>
                ) : (
                  <StatusPill status={STATUT_PILL[p.statut]}>{STATUT_LABEL[p.statut] ?? p.statut}</StatusPill>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {peutGerer && (
        <Panel title="Ajouter une pièce à la checklist">
          <form action={ajouterPieceRequise.bind(null, beneficiaireId)} className="flex flex-wrap items-center gap-2.5">
            <input
              name="type_document"
              required
              list="pieces-suggerees"
              placeholder="Type de pièce"
              className="flex-1 min-w-[220px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary"
            />
            <datalist id="pieces-suggerees">
              {suggestionsRestantes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
              Ajouter
            </button>
          </form>
        </Panel>
      )}
    </>
  )
}
