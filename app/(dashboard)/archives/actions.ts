'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function reactiverBeneficiaire(beneficiaireId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('beneficiaires').update({ statut_beneficiaire: 'actif' }).eq('id', beneficiaireId)
  revalidatePath('/archives')
  revalidatePath('/beneficiaires')
}
