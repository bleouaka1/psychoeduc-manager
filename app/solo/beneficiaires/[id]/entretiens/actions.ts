'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../../../_lib/getSoloOrg'
import { donneesEntretienGeneralParDefaut, donneesEntretienSpecialiseParDefaut } from '@/lib/entretiens'

export async function creerEntretien(beneficiaireId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const typeEntretien = String(formData.get('type_entretien') ?? '')
  if (!['general', 'specialise'].includes(typeEntretien)) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const donnees = typeEntretien === 'general' ? donneesEntretienGeneralParDefaut() : donneesEntretienSpecialiseParDefaut()

  const { data: entretien, error } = await supabase
    .from('entretiens')
    .insert({
      beneficiaire_id: beneficiaireId,
      organisation_id: organisation.id,
      type_entretien: typeEntretien,
      donnees,
      mene_par: user?.id,
      created_by: user?.id,
    })
    .select('id')
    .single()

  if (error || !entretien) return

  redirect(`/solo/beneficiaires/${beneficiaireId}/entretiens/${entretien.id}`)
}

/**
 * Appelée impérativement (pas via <form action>) depuis les fiches client, qui gèrent
 * un état local complexe (blocs thématiques dynamiques, chips). Retourne {error} plutôt
 * que Promise<void> — ce n'est pas lié à un <form action>.
 */
export async function enregistrerEntretien(
  entretienId: string,
  beneficiaireId: string,
  donnees: Record<string, unknown>,
  statut: 'brouillon' | 'valide',
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const patch: Record<string, unknown> = { donnees, statut, updated_by: user?.id }
  if (statut === 'valide') {
    patch.valide_par = user?.id
    patch.valide_le = new Date().toISOString()
  }

  const { error } = await supabase.from('entretiens').update(patch).eq('id', entretienId)
  if (error) return { error: error.message }

  revalidatePath(`/solo/beneficiaires/${beneficiaireId}/entretiens/${entretienId}`)
  revalidatePath(`/solo/beneficiaires/${beneficiaireId}`)
  return { error: null }
}

export async function supprimerEntretienBrouillon(entretienId: string, beneficiaireId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: entretien } = await supabase.from('entretiens').select('statut').eq('id', entretienId).single()
  if (!entretien) return { error: 'Fiche introuvable.' }
  if (entretien.statut !== 'brouillon') return { error: 'Une fiche déjà validée ne peut pas être supprimée.' }

  const { error } = await supabase.from('entretiens').delete().eq('id', entretienId)
  if (error) return { error: error.message }

  revalidatePath(`/solo/beneficiaires/${beneficiaireId}`)
  return { error: null }
}

/** Identification §2.2 T1 : scolarisation/classe appartiennent au bénéficiaire, pas à l'entretien. */
export async function mettreAJourScolarisation(beneficiaireId: string, scolarise: boolean, classe: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('beneficiaires')
    .update({ scolarise, classe: scolarise ? classe.trim() || null : null })
    .eq('id', beneficiaireId)
  if (error) return { error: error.message }

  revalidatePath(`/solo/beneficiaires/${beneficiaireId}`)
  return { error: null }
}
