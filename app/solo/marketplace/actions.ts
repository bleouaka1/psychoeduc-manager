'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../_lib/getSoloOrg'

export async function creerOffre(formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const titre = String(formData.get('titre') ?? '').trim()
  const type_offre = String(formData.get('type_offre') ?? '')
  const description = String(formData.get('description') ?? '').trim()
  const prixRaw = String(formData.get('prix') ?? '').trim()
  const prix = prixRaw ? Number(prixRaw) : null
  const image_couverture_url = String(formData.get('image_couverture_url') ?? '').trim() || null
  const stockRaw = String(formData.get('stock_disponible') ?? '').trim()
  const stock_disponible = stockRaw ? Number(stockRaw) : null
  const modalites_livraison = String(formData.get('modalites_livraison') ?? '').trim() || null
  const duree_texte = String(formData.get('duree_texte') ?? '').trim() || null
  const mode_transmission = String(formData.get('mode_transmission') ?? '') || null

  if (!titre || (type_offre !== 'produit' && type_offre !== 'service')) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('marketplace_offres').insert({
    organisation_id: organisation.id,
    type_offre,
    titre,
    description: description || null,
    prix,
    image_couverture_url,
    stock_disponible: type_offre === 'produit' ? stock_disponible : null,
    modalites_livraison: type_offre === 'produit' ? modalites_livraison : null,
    duree_texte: type_offre === 'service' ? duree_texte : null,
    mode_transmission: type_offre === 'service' ? mode_transmission : null,
    created_by: user?.id,
  })

  revalidatePath('/solo/marketplace')
}

export async function retirerOffre(offreId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('marketplace_offres').update({ statut: 'retiree' }).eq('id', offreId)
  revalidatePath('/solo/marketplace')
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
