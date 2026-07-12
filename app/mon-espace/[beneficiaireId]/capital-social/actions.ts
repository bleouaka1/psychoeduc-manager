'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/** Propose une relation avec le praticien référent de son organisation d'accompagnement
 * (premier_membre_actif déjà utilisé ailleurs dans ce projet pour résoudre le contact
 * principal d'une organisation). Portée V1 : Employeur/Structure différés (le module
 * Insertion professionnelle qui les rendrait pertinents n'existe pas encore). */
export async function proposerRelationFormateurAction(beneficiaireId: string, organisationId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profileId } = await supabase.rpc('premier_membre_actif', { p_organisation_id: organisationId })
  if (!profileId) return

  const { count } = await supabase
    .from('relations_capital_social')
    .select('id', { count: 'exact', head: true })
    .eq('beneficiaire_id', beneficiaireId)
    .eq('contact_profile_id', profileId)
  if ((count ?? 0) > 0) return

  await supabase.from('relations_capital_social').insert({
    beneficiaire_id: beneficiaireId,
    organisation_id: organisationId,
    type_relation: 'formateur_educateur',
    contact_profile_id: profileId,
    demande_par_profile_id: user.id,
  })

  revalidatePath(`/mon-espace/${beneficiaireId}/capital-social`)
}

/** Contexte partagé exigé (§7.2) : jamais de recherche libre dans l'annuaire des
 * bénéficiaires — uniquement un membre actif d'un même cercle d'apprentissage. */
export async function proposerRelationBeneficiaireAction(beneficiaireId: string, contactBeneficiaireId: string, organisationId: string, contexte: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { count } = await supabase
    .from('relations_capital_social')
    .select('id', { count: 'exact', head: true })
    .eq('beneficiaire_id', beneficiaireId)
    .eq('contact_beneficiaire_id', contactBeneficiaireId)
  if ((count ?? 0) > 0) return

  await supabase.from('relations_capital_social').insert({
    beneficiaire_id: beneficiaireId,
    organisation_id: organisationId,
    type_relation: 'beneficiaire',
    contact_beneficiaire_id: contactBeneficiaireId,
    contexte,
    demande_par_profile_id: user.id,
  })

  revalidatePath(`/mon-espace/${beneficiaireId}/capital-social`)
}

export async function confirmerRelationAction(beneficiaireId: string, relationId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('relations_capital_social').update({ statut: 'confirmee' }).eq('id', relationId)
  revalidatePath(`/mon-espace/${beneficiaireId}/capital-social`)
}

export async function refuserRelationAction(beneficiaireId: string, relationId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('relations_capital_social').update({ statut: 'refusee' }).eq('id', relationId)
  revalidatePath(`/mon-espace/${beneficiaireId}/capital-social`)
}
