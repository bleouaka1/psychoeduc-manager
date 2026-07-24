'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supprimerBeneficiaireAvecGarde } from '@/lib/beneficiaires'
import { getMonOrganisation } from '../_lib/getMonOrganisation'

export async function supprimerBeneficiaireFondateur(beneficiaireId: string): Promise<{ error: string | null }> {
  const res = await supprimerBeneficiaireAvecGarde(beneficiaireId)
  if (!res.error) revalidatePath('/beneficiaires')
  return res
}

/** Ajout de bénéficiaire côté Structure — n'existait nulle part sous (dashboard) jusqu'ici
 * (seul /solo/beneficiaires avait ce formulaire). Nécessaire pour que le Directeur ait un
 * point d'entrée réel avant de pouvoir créer une fiche d'entretien. */
export async function ajouterBeneficiaireStructure(formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const nom = String(formData.get('nom') ?? '').trim()
  const prenoms = String(formData.get('prenoms') ?? '').trim()
  if (!nom || !prenoms) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('beneficiaires').insert({
    organisation_id: organisation.id,
    nom,
    prenoms,
    statut_beneficiaire: 'actif',
    created_by: user?.id,
  })

  revalidatePath('/beneficiaires')
}
