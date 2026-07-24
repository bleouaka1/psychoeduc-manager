'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMonOrganisation } from '../../../_lib/getMonOrganisation'
import { donneesEntretienGeneralParDefaut, donneesEntretienSpecialiseParDefaut, type Interlocuteur } from '@/lib/entretiens'

/** Équivalent Structure de /solo/beneficiaires/[id]/entretiens/actions.ts — organisation
 * résolue via getMonOrganisation() plutôt que getSoloOrganisation(). Vérifie explicitement
 * que le bénéficiaire appartient bien à l'organisation résolue avant d'insérer : sans ce
 * garde-fou, un Directeur de l'Organisation A qui devine/visite l'URL d'un bénéficiaire de
 * l'Organisation B créerait un entretien avec organisation_id=A mais beneficiaire_id
 * pointant vers B — une incohérence de données que RLS seule ne suffit pas à empêcher ici
 * (peut_creer('entretiens', organisation_id) ne vérifie que l'organisation appelante, pas
 * la cohérence entre les deux FK insérées). */
export async function creerEntretien(beneficiaireId: string, formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const typeEntretien = String(formData.get('type_entretien') ?? '')
  if (!['general', 'specialise'].includes(typeEntretien)) return

  const supabase = await createClient()

  const { data: beneficiaire } = await supabase.from('beneficiaires').select('organisation_id').eq('id', beneficiaireId).single()
  if (!beneficiaire || beneficiaire.organisation_id !== organisation.id) return

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

  redirect(`/beneficiaires/${beneficiaireId}/entretiens/${entretien.id}`)
}

export async function enregistrerEntretien(
  entretienId: string,
  beneficiaireId: string,
  donnees: Record<string, unknown>,
  statut: 'brouillon' | 'valide',
  interlocuteur: Interlocuteur,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const patch: Record<string, unknown> = { donnees, statut, interlocuteur, updated_by: user?.id }
  if (statut === 'valide') {
    patch.valide_par = user?.id
    patch.valide_le = new Date().toISOString()
  }

  const { error } = await supabase.from('entretiens').update(patch).eq('id', entretienId)
  if (error) return { error: error.message }

  revalidatePath(`/beneficiaires/${beneficiaireId}/entretiens/${entretienId}`)
  revalidatePath(`/beneficiaires/${beneficiaireId}`)
  return { error: null }
}

/** Identification : scolarisation/classe appartiennent au bénéficiaire, pas à l'entretien
 * (même principe que côté Solo). */
export async function mettreAJourScolarisation(beneficiaireId: string, scolarise: boolean, classe: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('beneficiaires')
    .update({ scolarise, classe: scolarise ? classe.trim() || null : null })
    .eq('id', beneficiaireId)
  if (error) return { error: error.message }

  revalidatePath(`/beneficiaires/${beneficiaireId}`)
  return { error: null }
}
