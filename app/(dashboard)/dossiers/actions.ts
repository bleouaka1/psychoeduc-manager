'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMonOrganisation } from '../_lib/getMonOrganisation'

const STATUTS = ['manquant', 'recu', 'valide'] as const

export async function ajouterPieceRequise(beneficiaireId: string, formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const typeDocument = String(formData.get('type_document') ?? '').trim()
  if (!typeDocument) return

  const supabase = await createClient()
  const { data: beneficiaire } = await supabase.from('beneficiaires').select('organisation_id').eq('id', beneficiaireId).single()
  if (!beneficiaire || beneficiaire.organisation_id !== organisation.id) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('documents_beneficiaires').insert({
    beneficiaire_id: beneficiaireId,
    organisation_id: organisation.id,
    type_document: typeDocument,
    statut: 'manquant',
    televerse_par: user?.id,
  })
  revalidatePath(`/dossiers/${beneficiaireId}`)
  revalidatePath('/dossiers')
}

export async function mettreAJourStatutPiece(beneficiaireId: string, pieceId: string, statut: string): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return
  if (!STATUTS.includes(statut as (typeof STATUTS)[number])) return

  const supabase = await createClient()
  await supabase.from('documents_beneficiaires').update({ statut }).eq('id', pieceId).eq('organisation_id', organisation.id)
  revalidatePath(`/dossiers/${beneficiaireId}`)
  revalidatePath('/dossiers')
}
