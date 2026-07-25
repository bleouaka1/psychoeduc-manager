import type { SupabaseClient } from '@supabase/supabase-js'

/** Préférences personnelles (dashboard bénéficiaire v3, Lot F) — thème, accessibilité,
 * mode d'interaction. Toujours une valeur par défaut renvoyée même sans ligne en base
 * (nouvel utilisateur), jamais un état "non chargé" ambigu côté UI. */

export const THEMES = [
  { id: 'sombre_dore', nom: 'Sombre doré', description: 'Le thème par défaut — sobre avec des accents colorés par module' },
  { id: 'sobre_navy', nom: 'Sobre navy', description: "Une seule teinte d'accent (or), le plus institutionnel" },
  { id: 'terre_douce', nom: 'Terre douce', description: 'Tons verts et beiges, ambiance apaisante' },
  { id: 'contraste_eleve', nom: 'Contraste élevé', description: 'Pour une meilleure lisibilité (malvoyance, luminosité forte)' },
  { id: 'bleu_nuit', nom: 'Bleu nuit', description: 'Tons bleus froids, ambiance calme et concentrée' },
  { id: 'mode_clair', nom: 'Mode clair', description: 'Fond clair pour les environnements très lumineux ou en extérieur' },
  { id: 'terracotta', nom: 'Terracotta', description: 'Tons chauds orangés/bruns, énergique et accueillant' },
  { id: 'amethyste', nom: 'Améthyste', description: 'Violet profond, distingué et créatif' },
  { id: 'monochrome', nom: 'Monochrome', description: 'Niveaux de gris uniquement, épuré au maximum, zéro distraction' },
  { id: 'sable_desert', nom: 'Sable désert', description: 'Beige et ocre naturels, chaleureux et neutre' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']
export type ModeInteraction = 'texte' | 'vocal' | 'mixte'

export type PreferencesUtilisateur = {
  themeId: ThemeId
  modeAccessibilite: boolean
  modeInteraction: ModeInteraction
}

const PREFERENCES_DEFAUT: PreferencesUtilisateur = { themeId: 'sombre_dore', modeAccessibilite: false, modeInteraction: 'mixte' }

export async function chargerPreferences(supabase: SupabaseClient, profileId: string): Promise<PreferencesUtilisateur> {
  const { data } = await supabase
    .from('preferences_utilisateur')
    .select('theme_id, mode_accessibilite, mode_interaction')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (!data) return PREFERENCES_DEFAUT
  return { themeId: data.theme_id, modeAccessibilite: data.mode_accessibilite, modeInteraction: data.mode_interaction }
}
