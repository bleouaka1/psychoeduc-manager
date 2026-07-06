import { createClient } from '@/lib/supabase/server'

/** Champs communs à la création/modification d'une offre produit/service, partagés
 * entre le module Compte Solo et le module Employeur (mêmes règles, même formulaire). */
export function extraireChampsOffre(formData: FormData) {
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

  if (!titre || (type_offre !== 'produit' && type_offre !== 'service')) return null

  return {
    titre,
    type_offre,
    description: description || null,
    prix,
    image_couverture_url,
    stock_disponible: type_offre === 'produit' ? stock_disponible : null,
    modalites_livraison: type_offre === 'produit' ? modalites_livraison : null,
    duree_texte: type_offre === 'service' ? duree_texte : null,
    mode_transmission: type_offre === 'service' ? mode_transmission : null,
  }
}

/**
 * Suppression définitive, distincte de "Retirer" : si des commandes existent déjà sur
 * cette offre, on refuse et on propose de la retirer à la place — vérifié côté serveur,
 * même garde-fou que pour les formations (PROMPT-EDIT-DELETE-FORMATION.md).
 */
export async function supprimerOffreAvecGarde(offreId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { count } = await supabase.from('marketplace_commandes').select('id', { count: 'exact', head: true }).eq('offre_id', offreId)
  if (count && count > 0) {
    return { error: `Impossible de supprimer : ${count} commande(s) déjà passée(s) sur cette offre. Retirez-la à la place pour préserver l'historique des acheteurs.` }
  }

  const { error } = await supabase.from('marketplace_offres').delete().eq('id', offreId)
  if (error) return { error: error.message }
  return { error: null }
}
