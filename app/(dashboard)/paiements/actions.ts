'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMonOrganisation } from '../_lib/getMonOrganisation'

export async function creerPaiement(formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const beneficiaireId = String(formData.get('beneficiaire_id') ?? '')
  const typePaiement = String(formData.get('type_paiement') ?? '')
  const montantDu = Number(formData.get('montant_du'))
  const periode = String(formData.get('periode') ?? '').trim() || null
  const dateEcheance = String(formData.get('date_echeance') ?? '').trim() || null
  if (!beneficiaireId || !['inscription', 'scolarite'].includes(typePaiement) || !Number.isFinite(montantDu) || montantDu <= 0) return

  const supabase = await createClient()
  const { data: beneficiaire } = await supabase.from('beneficiaires').select('organisation_id').eq('id', beneficiaireId).single()
  if (!beneficiaire || beneficiaire.organisation_id !== organisation.id) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('paiements_scolarite').insert({
    organisation_id: organisation.id,
    beneficiaire_id: beneficiaireId,
    type_paiement: typePaiement,
    montant_du: montantDu,
    periode,
    date_echeance: dateEcheance,
    created_by: user?.id,
  })
  revalidatePath('/paiements')
}

/** Le montant payé n'est jamais modifié en place : chaque versement est une nouvelle ligne
 * append-only dans versements_scolarite, montant_paye/statut sur paiements_scolarite ne sont
 * qu'un cache recalculé par trigger (recalculer_paiement_scolarite). */
export async function enregistrerVersement(paiementId: string, formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const montant = Number(formData.get('montant'))
  const methode = String(formData.get('methode') ?? '').trim() || null
  if (!Number.isFinite(montant) || montant <= 0) return

  const supabase = await createClient()
  const { data: paiement } = await supabase.from('paiements_scolarite').select('organisation_id').eq('id', paiementId).single()
  if (!paiement || paiement.organisation_id !== organisation.id) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('versements_scolarite').insert({
    organisation_id: organisation.id,
    paiement_id: paiementId,
    montant,
    methode,
    created_by: user?.id,
  })
  revalidatePath('/paiements')
}
