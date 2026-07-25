import type { SupabaseClient } from '@supabase/supabase-js'

/** Abonnement bénéficiaire (dashboard bénéficiaire v2, Lot E) — schéma minimal, aucun
 * paiement récurrent réel. Distinct de lib/comptes.ts (abonnements/licences au niveau
 * organisation) : un bénéficiaire individuel n'a pas encore d'équivalent, ce module
 * lit juste le statut réel pour éviter d'afficher une valeur fictive. */

export type AbonnementBeneficiaire = {
  id: string
  formule: string
  statut: 'actif' | 'expire' | 'suspendu'
  dateDebut: string
  dateFin: string | null
  renouvellementAuto: boolean
}

export async function chargerAbonnementActif(supabase: SupabaseClient, beneficiaireId: string): Promise<AbonnementBeneficiaire | null> {
  const { data } = await supabase
    .from('abonnements_beneficiaire')
    .select('id, formule, statut, date_debut, date_fin, renouvellement_auto')
    .eq('beneficiaire_id', beneficiaireId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return {
    id: data.id,
    formule: data.formule,
    statut: data.statut,
    dateDebut: data.date_debut,
    dateFin: data.date_fin,
    renouvellementAuto: data.renouvellement_auto,
  }
}
