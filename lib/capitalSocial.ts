import type { SupabaseClient } from '@supabase/supabase-js'

/** Capital social bénéficiaire (CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md §7) —
 * réseau de relations confirmées mutuellement, distinct du module Étape 11
 * (evaluations_capital_social, score praticien) déjà existant et non touché. */

export type RelationCapitalSocial = {
  id: string
  typeRelation: 'formateur_educateur' | 'beneficiaire' | 'employeur' | 'structure'
  statut: 'en_attente' | 'confirmee' | 'refusee'
  contexte: string | null
  nomContact: string
  estDemandeur: boolean
}

export async function chargerCapitalSocial(supabase: SupabaseClient, beneficiaireId: string): Promise<RelationCapitalSocial[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: commeProprietaire }, { data: commeCible }] = await Promise.all([
    supabase
      .from('relations_capital_social')
      .select('id, type_relation, statut, contexte, demande_par_profile_id, contact_profile_id, contact_beneficiaire_id, profiles!contact_profile_id(nom, prenoms), beneficiaires!contact_beneficiaire_id(nom, prenoms)')
      .eq('beneficiaire_id', beneficiaireId),
    supabase
      .from('relations_capital_social')
      .select('id, type_relation, statut, contexte, demande_par_profile_id, beneficiaire_id, beneficiaires!beneficiaire_id(nom, prenoms)')
      .eq('contact_beneficiaire_id', beneficiaireId),
  ])

  const depuisProprietaire = (commeProprietaire ?? []).map((r: any) => ({
    id: r.id,
    typeRelation: r.type_relation,
    statut: r.statut,
    contexte: r.contexte,
    nomContact:
      r.type_relation === 'beneficiaire'
        ? `${r.beneficiaires?.prenoms ?? ''} ${r.beneficiaires?.nom ?? ''}`.trim()
        : `${r.profiles?.prenoms ?? ''} ${r.profiles?.nom ?? ''}`.trim() || 'Contact',
    estDemandeur: r.demande_par_profile_id === user?.id,
  }))

  const depuisCible = (commeCible ?? []).map((r: any) => ({
    id: r.id,
    typeRelation: r.type_relation as RelationCapitalSocial['typeRelation'],
    statut: r.statut,
    contexte: r.contexte,
    nomContact: `${r.beneficiaires?.prenoms ?? ''} ${r.beneficiaires?.nom ?? ''}`.trim(),
    estDemandeur: r.demande_par_profile_id === user?.id,
  }))

  return [...depuisProprietaire, ...depuisCible]
}

export type CamaradeCercle = { beneficiaireId: string; nom: string; prenoms: string; nomCercle: string }

/** Contexte partagé requis avant toute proposition de relation bénéficiaire↔bénéficiaire
 * (§7.2) : uniquement les membres ACTIFS des mêmes cercles d'apprentissage, jamais un
 * annuaire de recherche libre. */
export async function chargerCamaradesCercles(supabase: SupabaseClient, beneficiaireId: string): Promise<CamaradeCercle[]> {
  const { data: mesCercles } = await supabase.from('cercles_membres').select('cercle_id').eq('beneficiaire_id', beneficiaireId).eq('statut', 'actif')
  const cercleIds = (mesCercles ?? []).map((m: any) => m.cercle_id)
  if (cercleIds.length === 0) return []

  const { data: membres } = await supabase
    .from('cercles_membres')
    .select('beneficiaire_id, cercles_apprentissage(nom), beneficiaires(nom, prenoms)')
    .in('cercle_id', cercleIds)
    .eq('statut', 'actif')
    .neq('beneficiaire_id', beneficiaireId)

  const vus = new Set<string>()
  const resultat: CamaradeCercle[] = []
  for (const m of (membres ?? []) as any[]) {
    if (vus.has(m.beneficiaire_id)) continue
    vus.add(m.beneficiaire_id)
    resultat.push({ beneficiaireId: m.beneficiaire_id, nom: m.beneficiaires?.nom ?? '', prenoms: m.beneficiaires?.prenoms ?? '', nomCercle: m.cercles_apprentissage?.nom ?? '' })
  }
  return resultat
}
