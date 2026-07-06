'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getEmployeurOrganisation } from './_lib/getEmployeurOrg'
import { extraireChampsOffre, supprimerOffreAvecGarde } from '@/lib/marketplaceOffres'

export async function creerOffreEmployeur(formData: FormData): Promise<void> {
  const organisation = await getEmployeurOrganisation()
  if (!organisation) return

  const champs = extraireChampsOffre(formData)
  if (!champs) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('marketplace_offres').insert({ organisation_id: organisation.id, created_by: user?.id, ...champs })

  revalidatePath('/employeur')
}

export async function modifierOffreEmployeur(offreId: string, formData: FormData): Promise<void> {
  const champs = extraireChampsOffre(formData)
  if (!champs) return

  const supabase = await createClient()
  await supabase.from('marketplace_offres').update(champs).eq('id', offreId)

  revalidatePath('/employeur')
}

export async function retirerOffreEmployeur(offreId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('marketplace_offres').update({ statut: 'retiree' }).eq('id', offreId)
  revalidatePath('/employeur')
}

export async function supprimerOffreEmployeur(offreId: string): Promise<{ error: string | null }> {
  const res = await supprimerOffreAvecGarde(offreId)
  if (!res.error) revalidatePath('/employeur')
  return res
}
