import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { resoudreOrganisationApercu } from '@/lib/apercu'

export type EmployeurOrganisation = {
  id: string
  nom: string
  type_organisation: string
}

/**
 * Résout l'organisation de type "employeur" dont l'utilisateur connecté est membre.
 * Même principe que getSoloOrganisation() (Compte Solo) : un compte Employeur n'est
 * jamais une table séparée, c'est une organisation avec type_organisation='employeur'.
 *
 * Mode Aperçu (`lib/apercu.ts`) : voir getSoloOrganisation() pour le détail — même logique.
 */
export const getEmployeurOrganisation = cache(async (): Promise<EmployeurOrganisation | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const apercu = await resoudreOrganisationApercu(supabase, ['employeur'])
  if (apercu) return { id: apercu.id, nom: apercu.nom, type_organisation: apercu.type_organisation }

  const { data } = await supabase
    .from('membres_organisations')
    .select('organisations(id, nom, type_organisation)')
    .eq('profile_id', user.id)
    .eq('statut', 'actif')

  const membership = (data ?? []).find((m: any) => m.organisations?.type_organisation === 'employeur')
  return (membership as any)?.organisations ?? null
})
