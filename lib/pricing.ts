import type { SupabaseClient } from '@supabase/supabase-js'

/** Lecture du prix courant d'une fonctionnalité payante (handoff-icc-cv-navigation.md
 * §2.1) — toujours lu en base, jamais une constante codée en dur, pour permettre la
 * bascule FCFA → ECO (calendrier régional 2027) sans redéploiement de code. */

export type PrixCourant = { montant: number; devise: string }

export async function chargerPrixCourant(supabase: SupabaseClient, feature: string): Promise<PrixCourant | null> {
  const { data } = await supabase
    .from('pricing_config')
    .select('montant, devise')
    .eq('feature', feature)
    .lte('valide_a_partir_de', new Date().toISOString())
    .order('valide_a_partir_de', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? { montant: Number(data.montant), devise: data.devise } : null
}
