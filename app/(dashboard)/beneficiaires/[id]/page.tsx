import Link from 'next/link'
import { UserRound, NotebookPen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, StatusPill, EmptyState, IgaDial } from '../../_components/ui'
import { getMonOrganisation } from '../../_lib/getMonOrganisation'
import { creerEntretien } from './entretiens/actions'
import { calculerAge } from '@/lib/entretiens'

const STATUT_BENEFICIAIRE_LABEL: Record<string, string> = {
  actif: 'Actif',
  inactif: 'Inactif',
  suspendu: 'Suspendu',
  sorti: 'Sorti',
  archive: 'Archivé',
  en_attente: 'En attente de validation',
  refuse: 'Refusé',
}
const TYPE_ENTRETIEN_LABEL: Record<string, string> = { general: 'Général', specialise: 'Spécialisé' }

/**
 * Fiche bénéficiaire côté Structure/Fondateur — pendant simplifié de /solo/beneficiaires/[id]
 * (pas d'Objectifs/Messagerie ici, hors périmètre de l'étape 6 : uniquement identification,
 * historique IGA, et Entretiens — le point d'entrée qui manquait pour ce module).
 */
export default async function FicheBeneficiaireStructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: beneficiaire }, { data: evaluations }, { data: entretiens }] = await Promise.all([
    supabase.from('beneficiaires').select('id, nom, prenoms, date_naissance, statut_beneficiaire, created_at, organisations(nom)').eq('id', id).single(),
    supabase.from('evaluations_iga').select('score_global, niveau, date_evaluation').eq('beneficiaire_id', id).order('date_evaluation', { ascending: false }),
    supabase.from('entretiens').select('id, type_entretien, statut, date_entretien').eq('beneficiaire_id', id).order('created_at', { ascending: false }),
  ])

  if (!beneficiaire) return null

  const organisation = await getMonOrganisation()
  const peutCreerEntretien = organisation?.roles.some((r) => ['directeur', 'coordinateur', 'educateur', 'formateur', 'promoteur', 'administrateur'].includes(r))

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const derniereEval = evaluations?.[0]
  const age = calculerAge(beneficiaire.date_naissance)

  return (
    <>
      <PageHeader
        eyebrowIcon={UserRound}
        eyebrowText={(beneficiaire as any).organisations?.nom ?? 'Bénéficiaire'}
        title={`${beneficiaire.nom} ${beneficiaire.prenoms}`}
        subtitle={age !== null ? `${age} ans · Suivi depuis le ${formatter.format(new Date(beneficiaire.created_at))}` : `Suivi depuis le ${formatter.format(new Date(beneficiaire.created_at))}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <IgaDial value={derniereEval?.score_global ?? null} label="Dernier score IGA" />
        <Panel title="Statut">
          <StatusPill status={beneficiaire.statut_beneficiaire === 'actif' ? 'ok' : beneficiaire.statut_beneficiaire === 'refuse' ? 'down' : 'idle'}>
            {STATUT_BENEFICIAIRE_LABEL[beneficiaire.statut_beneficiaire] ?? beneficiaire.statut_beneficiaire}
          </StatusPill>
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

      <Panel title="Entretiens" icon={NotebookPen}>
        {peutCreerEntretien && (
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
        )}

        {(entretiens ?? []).length === 0 ? (
          <EmptyState text="Aucun entretien pour le moment." />
        ) : (
          <ul className="space-y-2">
            {(entretiens ?? []).map((e: any) => (
              <li key={e.id} className="flex items-center justify-between gap-3 bg-bg-surface border border-border-soft rounded-xl px-4 py-2.5">
                <Link href={`/beneficiaires/${id}/entretiens/${e.id}`} className="text-accent-gold hover:underline text-[13px]">
                  Entretien {TYPE_ENTRETIEN_LABEL[e.type_entretien] ?? e.type_entretien} — {formatter.format(new Date(e.date_entretien))}
                </Link>
                <StatusPill status={e.statut === 'valide' ? 'ok' : 'idle'}>{e.statut === 'valide' ? 'Validé' : 'Brouillon'}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
