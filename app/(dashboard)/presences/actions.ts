'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMonOrganisation } from '../_lib/getMonOrganisation'

export async function creerClasse(formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const nom = String(formData.get('nom') ?? '').trim()
  if (!nom) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('classes_groupes').insert({ organisation_id: organisation.id, nom, created_by: user?.id })
  revalidatePath('/presences')
}

export async function inscrireBeneficiaire(classeId: string, formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const beneficiaireId = String(formData.get('beneficiaire_id') ?? '')
  if (!beneficiaireId) return

  const supabase = await createClient()
  const { data: beneficiaire } = await supabase.from('beneficiaires').select('organisation_id').eq('id', beneficiaireId).single()
  if (!beneficiaire || beneficiaire.organisation_id !== organisation.id) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('inscriptions_classes').insert({
    organisation_id: organisation.id,
    classe_id: classeId,
    beneficiaire_id: beneficiaireId,
    created_by: user?.id,
  })
  revalidatePath('/presences')
}

/** Present/Absent/Retard du jour — upsert sur la contrainte unique (classe_id, beneficiaire_id,
 * date_seance) déjà en place depuis l'Étape 6 : ressaisir la présence d'un même bénéficiaire le
 * même jour corrige la ligne existante plutôt que d'en créer une seconde. */
export async function enregistrerPresence(classeId: string, beneficiaireId: string, dateSeance: string, statut: string): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return
  if (!['present', 'absent', 'retard'].includes(statut)) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase
    .from('presences')
    .upsert(
      { organisation_id: organisation.id, classe_id: classeId, beneficiaire_id: beneficiaireId, date_seance: dateSeance, statut, updated_by: user?.id },
      { onConflict: 'classe_id,beneficiaire_id,date_seance' },
    )
  revalidatePath('/presences')
}
