'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Branchée directement sur `<form action={...}>` : doit retourner void (React 19).
export async function sInscrireFormation(formationId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: formation } = await supabase.from('formations').select('organisation_id').eq('id', formationId).single()
  if (!formation) return

  await supabase.from('inscriptions_formations').insert({
    formation_id: formationId,
    acheteur_id: user.id,
    organisation_id: formation.organisation_id,
  })

  revalidatePath('/solo')
}
