'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from './_lib/getSoloOrg'

export async function mettreAJourProfilPublic(formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const bio = String(formData.get('bio') ?? '').trim()
  const specialitesRaw = String(formData.get('specialites') ?? '').trim()
  const specialites = specialitesRaw
    ? specialitesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const supabase = await createClient()
  await supabase.from('profils_publics_formateurs').upsert({ organisation_id: organisation.id, bio: bio || null, specialites })

  revalidatePath('/solo/profil')
}
