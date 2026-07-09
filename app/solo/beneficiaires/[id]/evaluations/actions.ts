'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../../../_lib/getSoloOrg'
import { calculerScoreEvaluation, niveauDepuisScore, type IndicateurSaisi } from '@/lib/iga'

export async function creerEvaluationIga(beneficiaireId: string, referentielId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Le poids de chaque critère/dimension est relu depuis la base (jamais fait confiance
  // à une valeur cliente) — seul le score_brut 0-4 saisi par le praticien vient du formulaire.
  const { data: dimensions } = await supabase.from('dimensions_iga').select('id, poids').eq('referentiel_id', referentielId)
  const { data: criteres } = await supabase
    .from('criteres_iga')
    .select('id, poids, dimension_id, dimensions_iga!inner(referentiel_id)')
    .eq('dimensions_iga.referentiel_id', referentielId)

  if (!dimensions || !criteres) return

  const indicateurs: IndicateurSaisi[] = []
  for (const critere of criteres) {
    const valeur = formData.get(`critere_${critere.id}`)
    if (valeur === null) continue
    const scoreBrut = Number(valeur)
    if (Number.isNaN(scoreBrut) || scoreBrut < 0 || scoreBrut > 4) continue
    indicateurs.push({ critereId: critere.id, dimensionId: critere.dimension_id, scoreBrut, poidsCritere: Number(critere.poids) })
  }

  if (indicateurs.length === 0) return

  const { scoresParDimension, scoreGlobal } = calculerScoreEvaluation(indicateurs, dimensions)
  const niveau = niveauDepuisScore(scoreGlobal)
  const commentaire = String(formData.get('commentaire') ?? '').trim() || null

  const { data: evaluation, error } = await supabase
    .from('evaluations_iga')
    .insert({
      beneficiaire_id: beneficiaireId,
      organisation_id: organisation.id,
      referentiel_version_id: referentielId,
      evalue_par: user?.id,
      score_global: scoreGlobal,
      niveau,
      commentaire,
      created_by: user?.id,
    })
    .select('id')
    .single()

  if (error || !evaluation) return

  await supabase.from('scores_iga').insert(
    scoresParDimension.map((s) => ({
      evaluation_id: evaluation.id,
      dimension_id: s.dimensionId,
      score: s.score,
    })),
  )

  await supabase.from('indicateurs_iga').insert(
    indicateurs.map((i) => ({
      evaluation_id: evaluation.id,
      critere_id: i.critereId,
      score_brut: i.scoreBrut,
      note_sur_20: (i.scoreBrut / 4) * 20,
    })),
  )

  revalidatePath(`/solo/beneficiaires/${beneficiaireId}`)
  redirect(`/solo/beneficiaires/${beneficiaireId}/evaluations/${evaluation.id}`)
}

export async function ajouterRecommandationIga(evaluationId: string, dimensionId: string, beneficiaireId: string, formData: FormData): Promise<void> {
  const recommandation = String(formData.get('recommandation') ?? '').trim()
  if (!recommandation) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('recommandations_iga').insert({
    evaluation_id: evaluationId,
    dimension_id: dimensionId,
    recommandation,
    created_by: user?.id,
  })

  revalidatePath(`/solo/beneficiaires/${beneficiaireId}/evaluations/${evaluationId}`)
}
