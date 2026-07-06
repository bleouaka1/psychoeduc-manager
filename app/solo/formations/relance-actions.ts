'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../_lib/getSoloOrg'

/**
 * Le message suggéré n'est jamais envoyé automatiquement : ce Server Action n'est
 * appelé que lorsque le formateur valide explicitement le contenu depuis la modale
 * de relance (cf. RelancerEleve.tsx), jamais en tâche de fond.
 */
export async function relancerEleve(acheteurId: string, formData: FormData): Promise<{ error: string | null }> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return { error: 'Aucun espace Solo associé à ce compte.' }

  const contenu = String(formData.get('contenu') ?? '').trim()
  if (!contenu) return { error: 'Le message ne peut pas être vide.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('messages').insert({
    organisation_id: organisation.id,
    expediteur_id: user?.id,
    destinataire_id: acheteurId,
    contenu,
    canal: 'interne',
    created_by: user?.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/solo/formations')
  return { error: null }
}
