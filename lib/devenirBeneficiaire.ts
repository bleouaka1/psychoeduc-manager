import type { SupabaseClient } from '@supabase/supabase-js'

/** Comptes multiprofils — "Devenir bénéficiaire" en self-service
 * (CLAUDE-CODE-COMPTES-MULTIPROFILS.md, §1). Réutilise `profils_publics_formateurs`
 * (RLS déjà ouverte à tous, vitrine marketplace) plutôt que d'interroger `organisations`
 * directement (RLS scopée aux membres) — même source que la marketplace publique. */

export type FormateurDisponible = { organisationId: string; nom: string; bio: string | null; typeOrganisation: string }

export async function chercherFormateurs(supabase: SupabaseClient, recherche: string, exclureOrganisationIds: string[]): Promise<FormateurDisponible[]> {
  const { data } = await supabase.from('profils_publics_formateurs').select('organisation_id, bio, organisations(nom, type_organisation)').limit(50)

  return (data ?? [])
    .map((p: any) => ({ organisationId: p.organisation_id, nom: p.organisations?.nom ?? '', bio: p.bio, typeOrganisation: p.organisations?.type_organisation ?? '' }))
    .filter((f) => !exclureOrganisationIds.includes(f.organisationId))
    .filter((f) => !recherche || f.nom.toLowerCase().includes(recherche.toLowerCase()))
    .sort((a, b) => a.nom.localeCompare(b.nom))
}
