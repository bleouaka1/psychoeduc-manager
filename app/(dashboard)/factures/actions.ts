'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMonOrganisation } from '../_lib/getMonOrganisation'

export async function genererFacture(paiementId: string): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const supabase = await createClient()
  const { data: paiement } = await supabase.from('paiements_scolarite').select('organisation_id').eq('id', paiementId).single()
  if (!paiement || paiement.organisation_id !== organisation.id) return

  const { count } = await supabase.from('factures_scolarite').select('id', { count: 'exact', head: true }).eq('organisation_id', organisation.id)
  const numeroFacture = `FA-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('factures_scolarite').insert({
    organisation_id: organisation.id,
    paiement_id: paiementId,
    numero_facture: numeroFacture,
    created_by: user?.id,
  })
  revalidatePath('/factures')
}
