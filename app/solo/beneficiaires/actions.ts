'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../_lib/getSoloOrg'
import { supprimerBeneficiaireAvecGarde } from '@/lib/beneficiaires'

export async function ajouterBeneficiaire(formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const nom = String(formData.get('nom') ?? '').trim()
  const prenoms = String(formData.get('prenoms') ?? '').trim()
  const commeDemande = formData.get('comme_demande') === 'on'
  if (!nom || !prenoms) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('beneficiaires').insert({
    organisation_id: organisation.id,
    nom,
    prenoms,
    statut_beneficiaire: commeDemande ? 'en_attente' : 'actif',
    created_by: user?.id,
  })

  revalidatePath('/solo/beneficiaires')
}

export async function validerDemande(beneficiaireId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase
    .from('beneficiaires')
    .update({ statut_beneficiaire: 'actif', valide_par: user?.id, date_validation: new Date().toISOString() })
    .eq('id', beneficiaireId)

  revalidatePath('/solo/beneficiaires')
}

export async function refuserDemande(beneficiaireId: string, formData: FormData): Promise<void> {
  const motif = String(formData.get('motif') ?? '').trim()
  const supabase = await createClient()

  await supabase.from('beneficiaires').update({ statut_beneficiaire: 'refuse', motif_refus: motif || null }).eq('id', beneficiaireId)

  revalidatePath('/solo/beneficiaires')
}

export async function archiverBeneficiaire(beneficiaireId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('beneficiaires').update({ statut_beneficiaire: 'archive' }).eq('id', beneficiaireId)
  revalidatePath('/solo/beneficiaires')
}

export async function reactiverBeneficiaire(beneficiaireId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('beneficiaires').update({ statut_beneficiaire: 'actif' }).eq('id', beneficiaireId)
  revalidatePath('/solo/archives')
  revalidatePath('/solo/beneficiaires')
}

export async function supprimerBeneficiaire(beneficiaireId: string): Promise<{ error: string | null }> {
  const res = await supprimerBeneficiaireAvecGarde(beneficiaireId)
  if (!res.error) revalidatePath('/solo/beneficiaires')
  return res
}
