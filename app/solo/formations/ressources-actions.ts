'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../_lib/getSoloOrg'

const BUCKET = 'ressources-formations'

export async function televerserRessource(formationId: string, formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const fichier = formData.get('fichier') as File | null
  if (!fichier || fichier.size === 0) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const chemin = `${formationId}/${Date.now()}-${fichier.name}`
  const { error: erreurUpload } = await supabase.storage.from(BUCKET).upload(chemin, fichier, { contentType: fichier.type })
  if (erreurUpload) return

  await supabase.from('ressources_formation').insert({
    formation_id: formationId,
    organisation_id: organisation.id,
    nom_fichier: fichier.name,
    chemin_storage: chemin,
    taille_octets: fichier.size,
    type_mime: fichier.type,
    created_by: user?.id,
  })

  revalidatePath('/solo/formations')
}

export async function supprimerRessource(ressourceId: string, chemin: string): Promise<void> {
  const supabase = await createClient()
  await supabase.storage.from(BUCKET).remove([chemin])
  await supabase.from('ressources_formation').delete().eq('id', ressourceId)
  revalidatePath('/solo/formations')
}
