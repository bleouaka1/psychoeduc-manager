'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMonOrganisation } from '../_lib/getMonOrganisation'

export async function creerEtablissement(formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return
  if (!organisation.roles.some((r) => ['directeur', 'promoteur'].includes(r))) return

  const nom = String(formData.get('nom') ?? '').trim()
  if (!nom) return
  const adresse = String(formData.get('adresse') ?? '').trim() || null
  const rythmeJours = String(formData.get('rythme_jours') ?? '') || null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('etablissements').insert({
    organisation_id: organisation.id,
    nom,
    adresse,
    rythme_jours: rythmeJours,
    created_by: user?.id,
  })
  revalidatePath('/etablissements')
}

/** Jamais de suppression physique — un établissement fermé passe à `actif = false`, ses
 * bénéficiaires/membres qui y étaient rattachés (etablissement_id) restent historiquement
 * référencés (même principe que la révocation d'un membre d'équipe, §4.6 du document). */
export async function basculerActifEtablissement(etablissementId: string, actif: boolean): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return
  if (!organisation.roles.some((r) => ['directeur', 'promoteur'].includes(r))) return

  const supabase = await createClient()
  await supabase.from('etablissements').update({ actif }).eq('id', etablissementId).eq('organisation_id', organisation.id)
  revalidatePath('/etablissements')
}
