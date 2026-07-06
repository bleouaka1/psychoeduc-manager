import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Publication automatique des formations dans la Marketplace — ÉTAPE 2/3.
 * Logique en TypeScript standard plutôt qu'un trigger SQL supplémentaire
 * (préférence explicite : "logique métier découplée du fournisseur cloud",
 * déjà appliquée ailleurs dans le projet pour les calculs IGA/financiers).
 *
 * Le statut ('visible_en_verification') n'est PAS fixé ici : le trigger
 * `enforce_marketplace_offre_statut` (Étape 1/3, schéma) l'assigne
 * automatiquement à l'INSERT dès que `type_offre='formation'` et
 * `formation_id` est renseigné — une seule source de vérité pour cette règle,
 * qu'un futur appelant passe ou non par cette fonction.
 */
const TYPES_ORGANISATION_AUTO_PUBLICATION = ['solo', 'structure']

type FormationPourPublication = {
  id: string
  organisation_id: string
  titre: string
  description: string | null
  prix: number | null
  devise: string
  duree_texte: string | null
  mode_transmission: string | null
  image_couverture_url: string | null
  video_url: string | null
}

export async function publierFormationSurMarketplace(
  supabase: SupabaseClient,
  formation: FormationPourPublication,
  typeOrganisation: string,
  createdBy: string | undefined,
): Promise<void> {
  if (!TYPES_ORGANISATION_AUTO_PUBLICATION.includes(typeOrganisation)) return

  await supabase.from('marketplace_offres').insert({
    organisation_id: formation.organisation_id,
    type_offre: 'formation',
    formation_id: formation.id,
    titre: formation.titre,
    description: formation.description,
    prix: formation.prix,
    devise: formation.devise,
    duree_texte: formation.duree_texte,
    mode_transmission: formation.mode_transmission,
    image_couverture_url: formation.image_couverture_url,
    video_url: formation.video_url,
    created_by: createdBy,
  })
}
