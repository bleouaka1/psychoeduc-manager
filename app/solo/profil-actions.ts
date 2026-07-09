'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from './_lib/getSoloOrg'

export async function mettreAJourProfilPublic(formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const bio = String(formData.get('bio') ?? '').trim().slice(0, 400)
  const specialitesRaw = String(formData.get('specialites') ?? '').trim()
  const specialites = specialitesRaw
    ? specialitesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : []
  const cv_url = String(formData.get('cv_url') ?? '').trim() || null
  const cv_texte = String(formData.get('cv_texte') ?? '').trim() || null
  const specialites_dimensions_iga = formData.getAll('specialites_dimensions_iga').map((v) => String(v))

  const supabase = await createClient()
  await supabase
    .from('profils_publics_formateurs')
    .upsert({ organisation_id: organisation.id, bio: bio || null, specialites, specialites_dimensions_iga, cv_url, cv_texte })

  revalidatePath('/solo/profil')
}

/** Appelée depuis UploadPhotoProfil.tsx après recadrage + upload côté client. */
export async function enregistrerPhotoProfil(photoUrl: string): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const supabase = await createClient()
  await supabase.from('profils_publics_formateurs').upsert({ organisation_id: organisation.id, photo_url: photoUrl })

  revalidatePath('/solo/profil')
}
