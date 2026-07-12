import Link from 'next/link'
import { Award, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel } from '../../../../(dashboard)/_components/ui'
import { getSoloOrganisation } from '../../../_lib/getSoloOrg'
import { TAGS_SAVOIR_ETRE } from '@/lib/icc'
import { chargerFormationsAvecIcc } from '@/lib/iccServer'
import { creerCompetenceAction, evaluerSavoirAction, evaluerSavoirFaireAction, observerSavoirEtreAction } from './actions'

const NIVEAU_LABEL: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', autonome: 'Autonome', expert: 'Expert' }

export default async function IccBeneficiairePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ formation?: string }> }) {
  const { id } = await params
  const { formation: formationId } = await searchParams
  const organisation = await getSoloOrganisation()
  if (!organisation) return null

  const supabase = await createClient()
  const { data: beneficiaire } = await supabase.from('beneficiaires').select('nom, prenoms').eq('id', id).eq('organisation_id', organisation.id).single()
  if (!beneficiaire) return null

  const { data: formations } = await supabase.from('formations').select('id, titre').eq('organisation_id', organisation.id).order('titre')

  if (!formationId) {
    return (
      <>
        <PageHeader
          eyebrowIcon={Award}
          eyebrowText="Mon espace Solo"
          title="ICC — Indice de Compétences"
          subtitle={`${beneficiaire.nom} ${beneficiaire.prenoms}`}
          actions={
            <Link href={`/solo/beneficiaires/${id}`} className="flex items-center gap-1.5 bg-bg-card border border-border-soft text-text-primary text-[13px] font-medium px-4 py-2.5 rounded-full">
              <ArrowLeft size={14} /> Retour à la fiche
            </Link>
          }
        />
        <Panel title="Choisir une formation">
          {(formations ?? []).length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">Aucune formation créée pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {(formations ?? []).map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/solo/beneficiaires/${id}/icc?formation=${f.id}`}
                    className="flex items-center justify-between bg-bg-surface border border-border-soft rounded-xl px-4 py-3 hover:border-accent-gold-dim transition-colors"
                  >
                    <span className="text-text-primary text-[13.5px]">{f.titre}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </>
    )
  }

  const [{ data: competences }, { data: evaluationsSavoir }, { data: evaluationsSavoirFaire }, { data: observations }, iccFormations] = await Promise.all([
    supabase.from('icc_competences').select('id, type, libelle').eq('formation_id', formationId).order('created_at'),
    supabase.from('icc_evaluations_savoir').select('competence_id, moment, maitrise').eq('beneficiaire_id', id),
    supabase.from('icc_evaluations_savoir_faire').select('competence_id, niveau').eq('beneficiaire_id', id),
    supabase.from('icc_observations_savoir_etre').select('tag').eq('beneficiaire_id', id).eq('formation_id', formationId),
    chargerFormationsAvecIcc(supabase, id),
  ])

  const formationTitre = (formations ?? []).find((f) => f.id === formationId)?.titre ?? ''
  const competencesSavoir = (competences ?? []).filter((c) => c.type === 'savoir')
  const competencesSavoirFaire = (competences ?? []).filter((c) => c.type === 'savoir_faire')
  const evalSavoirParCompetence = new Map<string, { avant: boolean | null; apres: boolean | null }>()
  for (const e of evaluationsSavoir ?? []) {
    const cur = evalSavoirParCompetence.get(e.competence_id) ?? { avant: null, apres: null }
    if (e.moment === 'avant') cur.avant = e.maitrise
    else cur.apres = e.maitrise
    evalSavoirParCompetence.set(e.competence_id, cur)
  }
  const niveauParCompetence = new Map((evaluationsSavoirFaire ?? []).map((e) => [e.competence_id, e.niveau]))
  const tagsObserves = new Set((observations ?? []).map((o) => o.tag))
  const scoreFormation = iccFormations.find((f) => f.formationId === formationId)?.score

  return (
    <>
      <PageHeader
        eyebrowIcon={Award}
        eyebrowText="Mon espace Solo"
        title={`ICC — ${formationTitre}`}
        subtitle={`${beneficiaire.nom} ${beneficiaire.prenoms}`}
        actions={
          <Link href={`/solo/beneficiaires/${id}/icc`} className="flex items-center gap-1.5 bg-bg-card border border-border-soft text-text-primary text-[13px] font-medium px-4 py-2.5 rounded-full">
            <ArrowLeft size={14} /> Changer de formation
          </Link>
        }
      />

      {scoreFormation && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-bg-card border border-border-soft rounded-2xl p-4 text-center">
            <p className="text-text-muted text-[11px] mb-1">Savoirs</p>
            <p className="font-data text-2xl text-accent-gold">{scoreFormation.savoirs ?? '—'}</p>
          </div>
          <div className="bg-bg-card border border-border-soft rounded-2xl p-4 text-center">
            <p className="text-text-muted text-[11px] mb-1">Savoir-faire</p>
            <p className="font-data text-2xl text-accent-gold">{scoreFormation.savoirFaire ?? '—'}</p>
          </div>
          <div className="bg-bg-card border border-border-soft rounded-2xl p-4 text-center">
            <p className="text-text-muted text-[11px] mb-1">Savoir-être</p>
            <p className="font-data text-2xl text-accent-gold">{scoreFormation.savoirEtre ?? '—'}</p>
          </div>
        </div>
      )}

      <Panel title="Savoirs (test avant/après)" className="mb-6">
        <form action={creerCompetenceAction.bind(null, id, formationId)} className="flex flex-wrap gap-2.5 mb-4">
          <input type="hidden" name="type" value="savoir" />
          <input name="libelle" required placeholder="Ex. Connaît les 4 opérations de base" className="flex-1 min-w-[220px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
          <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
            Ajouter
          </button>
        </form>
        {competencesSavoir.length === 0 ? (
          <p className="text-text-muted text-sm py-2 text-center">Aucun savoir défini pour cette formation.</p>
        ) : (
          <ul className="space-y-2.5">
            {competencesSavoir.map((c) => {
              const evalu = evalSavoirParCompetence.get(c.id) ?? { avant: null, apres: null }
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 bg-bg-surface border border-border-soft rounded-xl px-4 py-3 flex-wrap">
                  <span className="text-text-primary text-[13px]">{c.libelle}</span>
                  <div className="flex items-center gap-2">
                    <form action={evaluerSavoirAction.bind(null, id, c.id)}>
                      <input type="hidden" name="moment" value="avant" />
                      <input type="hidden" name="maitrise" value={(!evalu.avant).toString()} />
                      <button type="submit" className={`text-[11.5px] px-2.5 py-1 rounded-full border ${evalu.avant ? 'border-accent-teal text-accent-teal' : 'border-border-soft text-text-muted'}`}>
                        Avant : {evalu.avant ? 'Maîtrisé' : 'Non maîtrisé'}
                      </button>
                    </form>
                    <form action={evaluerSavoirAction.bind(null, id, c.id)}>
                      <input type="hidden" name="moment" value="apres" />
                      <input type="hidden" name="maitrise" value={(!evalu.apres).toString()} />
                      <button type="submit" className={`text-[11.5px] px-2.5 py-1 rounded-full border ${evalu.apres ? 'border-accent-teal text-accent-teal' : 'border-border-soft text-text-muted'}`}>
                        Après : {evalu.apres ? 'Maîtrisé' : 'Non maîtrisé'}
                      </button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Savoir-faire (débutant → expert)" className="mb-6">
        <form action={creerCompetenceAction.bind(null, id, formationId)} className="flex flex-wrap gap-2.5 mb-4">
          <input type="hidden" name="type" value="savoir_faire" />
          <input name="libelle" required placeholder="Ex. Manier une scie électrique" className="flex-1 min-w-[220px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
          <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
            Ajouter
          </button>
        </form>
        {competencesSavoirFaire.length === 0 ? (
          <p className="text-text-muted text-sm py-2 text-center">Aucune compétence pratique définie pour cette formation.</p>
        ) : (
          <ul className="space-y-2.5">
            {competencesSavoirFaire.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 bg-bg-surface border border-border-soft rounded-xl px-4 py-3 flex-wrap">
                <span className="text-text-primary text-[13px]">{c.libelle}</span>
                <form action={evaluerSavoirFaireAction.bind(null, id, c.id)} className="flex items-center gap-1.5">
                  <select
                    name="niveau"
                    defaultValue={niveauParCompetence.get(c.id) ?? ''}
                    className="bg-bg-surface border border-border-soft rounded-lg px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none focus:border-accent-gold-dim"
                  >
                    <option value="" disabled>
                      Choisir un niveau
                    </option>
                    {Object.entries(NIVEAU_LABEL).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="text-[11.5px] font-semibold text-bg-base bg-accent-gold rounded-full px-2.5 py-1.5">
                    OK
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Savoir-être (observations positives)">
        <p className="text-text-muted text-[12.5px] mb-3">
          Référentiel fixe (§4.2.3) — jamais les tags cliniques des fiches entretien, réservés à un usage différent.
        </p>
        <div className="flex flex-wrap gap-2">
          {TAGS_SAVOIR_ETRE.map((tag) => {
            const observe = tagsObserves.has(tag)
            return (
              <form key={tag} action={observerSavoirEtreAction.bind(null, id, formationId)}>
                <input type="hidden" name="tag" value={tag} />
                <button
                  type="submit"
                  disabled={observe}
                  className={`text-[12px] px-3 py-1.5 rounded-full border ${observe ? 'border-accent-teal text-accent-teal cursor-default' : 'border-border-soft text-text-muted hover:border-accent-gold-dim'}`}
                >
                  {tag} {observe && '✓'}
                </button>
              </form>
            )
          })}
        </div>
      </Panel>
    </>
  )
}
