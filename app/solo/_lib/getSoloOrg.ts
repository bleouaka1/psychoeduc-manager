import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type SoloOrganisation = {
  id: string
  nom: string
  type_organisation: string
}

/**
 * Résout l'organisation de type "solo" dont l'utilisateur connecté est membre.
 * Un compte Solo n'est jamais une table séparée : c'est une organisation avec
 * type_organisation='solo' (cf. architecture v5). Un même utilisateur (ex. le
 * Fondateur) peut être membre de plusieurs organisations ; on prend la première
 * de type solo trouvée. Mise en cache par requête (layout + page l'appellent tous les deux).
 */
export const getSoloOrganisation = cache(async (): Promise<SoloOrganisation | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('membres_organisations')
    .select('organisations(id, nom, type_organisation)')
    .eq('profile_id', user.id)
    .eq('statut', 'actif')

  const membership = (data ?? []).find((m: any) => m.organisations?.type_organisation === 'solo')
  return (membership as any)?.organisations ?? null
})

export const getIsFondateur = cache(async (): Promise<boolean> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('is_fondateur')
  return Boolean(data)
})
