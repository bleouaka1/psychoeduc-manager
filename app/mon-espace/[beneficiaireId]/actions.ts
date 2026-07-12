'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/** Le bénéficiaire crée son propre projet de vie, en autonomie (levier "Autonomie"
 * du document, §1) — RLS déjà ouverte (beneficiaires.profile_id = auth.uid(),
 * migration 20260725000000). organisation_id repris directement du dossier
 * bénéficiaire, jamais saisi par le bénéficiaire lui-même. */
export async function creerProjetVieBeneficiaireAction(beneficiaireId: string, formData: FormData): Promise<void> {
  const titre = String(formData.get('titre') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  if (!titre) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: beneficiaire } = await supabase.from('beneficiaires').select('organisation_id').eq('id', beneficiaireId).maybeSingle()
  if (!beneficiaire) return

  await supabase.from('projets_vie').insert({
    beneficiaire_id: beneficiaireId,
    organisation_id: beneficiaire.organisation_id,
    titre,
    description: description || null,
    created_by: user?.id,
  })

  revalidatePath(`/mon-espace/${beneficiaireId}/projets-vie`)
  revalidatePath(`/mon-espace/${beneficiaireId}`)
}
