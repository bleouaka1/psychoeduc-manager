'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../_lib/getSoloOrg'
import { extraireChampsOffre, supprimerOffreAvecGarde } from '@/lib/marketplaceOffres'
import { repondreMessageOffre } from '@/lib/marketplaceMessages'

export async function creerOffre(formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const champs = extraireChampsOffre(formData)
  if (!champs) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('marketplace_offres').insert({ organisation_id: organisation.id, created_by: user?.id, ...champs })

  revalidatePath('/solo/marketplace')
}

export async function modifierOffre(offreId: string, formData: FormData): Promise<void> {
  const champs = extraireChampsOffre(formData)
  if (!champs) return

  const supabase = await createClient()
  await supabase.from('marketplace_offres').update(champs).eq('id', offreId)

  revalidatePath('/solo/marketplace')
}

export async function retirerOffre(offreId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('marketplace_offres').update({ statut: 'retiree' }).eq('id', offreId)
  revalidatePath('/solo/marketplace')
}

export async function supprimerOffre(offreId: string): Promise<{ error: string | null }> {
  const res = await supprimerOffreAvecGarde(offreId)
  if (!res.error) revalidatePath('/solo/marketplace')
  return res
}

export async function sAchterOffre(offreId: string, montant: number, organisationId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('marketplace_commandes').insert({
    offre_id: offreId,
    acheteur_id: user.id,
    montant_brut: montant,
    organisation_id: organisationId,
  })

  revalidatePath('/solo/marketplace')
}

export async function repondreMessageModeration(offreId: string, contenu: string): Promise<{ error: string | null }> {
  const res = await repondreMessageOffre(offreId, contenu)
  if (!res.error) revalidatePath('/solo/marketplace')
  return res
}

export async function basculerFavori(offreType: 'formation' | 'marketplace_offre', offreId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: existant } = await supabase
    .from('favoris_marketplace')
    .select('id')
    .eq('profile_id', user.id)
    .eq('offre_type', offreType)
    .eq('offre_id', offreId)
    .maybeSingle()

  if (existant) {
    await supabase.from('favoris_marketplace').delete().eq('id', existant.id)
  } else {
    await supabase.from('favoris_marketplace').insert({ profile_id: user.id, offre_type: offreType, offre_id: offreId })
  }

  revalidatePath('/solo/marketplace')
}
