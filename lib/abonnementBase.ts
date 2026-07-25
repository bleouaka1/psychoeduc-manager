import type { SupabaseClient } from '@supabase/supabase-js'

/** Abonnement de base (dashboard bénéficiaire v3, Lot H) — débloque le moteur de quiz
 * sans IA (200 FCFA/mois, multi-payeur). Distinct de `abonnements_beneficiaire`
 * (schéma minimal posé en v2, sans paiement réel) : celui-ci a un vrai cycle
 * actif/expiré avec des périodes, alimenté par confirmer_abonnement_base(). */

export type StatutAbonnementBase = 'actif' | 'expire' | 'aucun'

export type AbonnementBaseActuel = {
  statut: StatutAbonnementBase
  typeFormule: string | null
  periodeFin: string | null
}

export async function chargerAbonnementBaseActif(supabase: SupabaseClient, beneficiaireId: string): Promise<AbonnementBaseActuel> {
  const { data } = await supabase
    .from('abonnements_base')
    .select('type_formule, statut, periode_fin')
    .eq('beneficiaire_id', beneficiaireId)
    .order('periode_fin', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { statut: 'aucun', typeFormule: null, periodeFin: null }

  const actif = data.statut === 'actif' && new Date(data.periode_fin).getTime() > Date.now()
  return { statut: actif ? 'actif' : 'expire', typeFormule: data.type_formule, periodeFin: data.periode_fin }
}

/** Plafonds de fair-use (§7 du handoff v5) — invisibles pour l'utilisateur, jamais
 * annoncés comme une limite stricte. Nombre de sessions Espace Tuteurs incluses par
 * jour SANS débit de crédit, selon la formule active. `null` = pas de sessions
 * incluses (formule base ou aucun abonnement) — chaque session reste payée en crédits. */
export function plafondSessionsTuteurParJour(typeFormule: string | null): number | null {
  if (typeFormule === 'pack_2_matieres') return 2
  if (typeFormule === 'tout_inclus') return 5
  return null
}
