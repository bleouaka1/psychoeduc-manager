'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function laisserAvis(formationId: string, organisationId: string, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const note = Number(formData.get('note') ?? 0)
  const commentaire = String(formData.get('commentaire') ?? '').trim()
  if (note < 1 || note > 5) return

  await supabase.from('avis_formations').upsert(
    {
      formation_id: formationId,
      organisation_id: organisationId,
      acheteur_id: user.id,
      note,
      commentaire: commentaire || null,
    },
    { onConflict: 'formation_id,acheteur_id' },
  )

  revalidatePath('/solo')
}
