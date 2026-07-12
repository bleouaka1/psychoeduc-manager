'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../../../_lib/getSoloOrg'

export async function creerCompetenceAction(beneficiaireId: string, formationId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const type = String(formData.get('type') ?? '')
  const libelle = String(formData.get('libelle') ?? '').trim()
  if (!libelle || !['savoir', 'savoir_faire'].includes(type)) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('icc_competences').insert({ formation_id: formationId, organisation_id: organisation.id, type, libelle, created_by: user?.id })
  revalidatePath(`/solo/beneficiaires/${beneficiaireId}/icc`)
}

export async function evaluerSavoirAction(beneficiaireId: string, competenceId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const moment = String(formData.get('moment') ?? '')
  const maitrise = formData.get('maitrise') === 'true'
  if (!['avant', 'apres'].includes(moment)) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase
    .from('icc_evaluations_savoir')
    .upsert(
      { competence_id: competenceId, beneficiaire_id: beneficiaireId, organisation_id: organisation.id, moment, maitrise, evalue_par: user?.id, date_evaluation: new Date().toISOString() },
      { onConflict: 'competence_id,beneficiaire_id,moment' },
    )

  revalidatePath(`/solo/beneficiaires/${beneficiaireId}/icc`)
}

export async function evaluerSavoirFaireAction(beneficiaireId: string, competenceId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const niveau = String(formData.get('niveau') ?? '')
  if (!['debutant', 'intermediaire', 'autonome', 'expert'].includes(niveau)) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase
    .from('icc_evaluations_savoir_faire')
    .upsert(
      { competence_id: competenceId, beneficiaire_id: beneficiaireId, organisation_id: organisation.id, niveau, evalue_par: user?.id, date_evaluation: new Date().toISOString() },
      { onConflict: 'competence_id,beneficiaire_id' },
    )

  revalidatePath(`/solo/beneficiaires/${beneficiaireId}/icc`)
}

export async function observerSavoirEtreAction(beneficiaireId: string, formationId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const tag = String(formData.get('tag') ?? '')
  if (!tag) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('icc_observations_savoir_etre').insert({ beneficiaire_id: beneficiaireId, formation_id: formationId, organisation_id: organisation.id, tag, evalue_par: user?.id })
  revalidatePath(`/solo/beneficiaires/${beneficiaireId}/icc`)
}
