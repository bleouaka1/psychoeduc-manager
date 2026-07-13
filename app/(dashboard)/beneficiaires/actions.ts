'use server'

import { revalidatePath } from 'next/cache'
import { supprimerBeneficiaireAvecGarde } from '@/lib/beneficiaires'

export async function supprimerBeneficiaireFondateur(beneficiaireId: string): Promise<{ error: string | null }> {
  const res = await supprimerBeneficiaireAvecGarde(beneficiaireId)
  if (!res.error) revalidatePath('/beneficiaires')
  return res
}
