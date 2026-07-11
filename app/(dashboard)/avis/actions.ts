'use server'

import { revalidatePath } from 'next/cache'
import { moderarAvisBeneficiaire } from '@/lib/avisBeneficiaires'

export async function publierAvisAction(avisId: string): Promise<{ error: string | null }> {
  const res = await moderarAvisBeneficiaire(avisId, 'publie')
  revalidatePath('/avis')
  return res
}

export async function masquerAvisAction(avisId: string): Promise<{ error: string | null }> {
  const res = await moderarAvisBeneficiaire(avisId, 'masque')
  revalidatePath('/avis')
  return res
}

export async function retirerAvisAction(avisId: string): Promise<{ error: string | null }> {
  const res = await moderarAvisBeneficiaire(avisId, 'retiree')
  revalidatePath('/avis')
  return res
}
