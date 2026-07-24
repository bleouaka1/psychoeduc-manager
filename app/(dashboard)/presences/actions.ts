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

/** §4.7 : "bascule annuelle / promotion de cohorte" — action groupée en un clic plutôt que
 * réinscrire élève par élève. Crée la nouvelle classe, marque chaque inscription active de
 * l'ancienne classe `transferee` (jamais supprimée : historique des présences intact, toujours
 * rattaché à `classe_id` de l'ancienne classe) et réinscrit chaque bénéficiaire dans la nouvelle. */
export async function basculerCohorte(classeSourceId: string, formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const nom = String(formData.get('nouveau_nom') ?? '').trim()
  if (!nom) return
  const niveau = String(formData.get('niveau') ?? '').trim() || null
  const anneeScolaire = String(formData.get('annee_scolaire') ?? '').trim() || null

  const supabase = await createClient()
  const { data: classeSource } = await supabase.from('classes_groupes').select('organisation_id').eq('id', classeSourceId).single()
  if (!classeSource || classeSource.organisation_id !== organisation.id) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: nouvelleClasse, error } = await supabase
    .from('classes_groupes')
    .insert({ organisation_id: organisation.id, nom, niveau, annee_scolaire: anneeScolaire, created_by: user?.id })
    .select('id')
    .single()
  if (error || !nouvelleClasse) return

  const { data: inscriptionsActives } = await supabase
    .from('inscriptions_classes')
    .select('id, beneficiaire_id')
    .eq('classe_id', classeSourceId)
    .eq('statut', 'active')

  for (const inscription of inscriptionsActives ?? []) {
    await supabase.from('inscriptions_classes').update({ statut: 'transferee', updated_by: user?.id }).eq('id', inscription.id)
    await supabase.from('inscriptions_classes').insert({
      organisation_id: organisation.id,
      classe_id: nouvelleClasse.id,
      beneficiaire_id: inscription.beneficiaire_id,
      created_by: user?.id,
    })
  }

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
