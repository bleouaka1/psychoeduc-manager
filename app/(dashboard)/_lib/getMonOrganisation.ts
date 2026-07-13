import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type MonOrganisation = {
  id: string
  nom: string
  type_organisation: string
  membre_organisation_id: string
  roles: string[]
}

/**
 * Résout l'organisation "de travail" du membre connecté pour les pages génériques du
 * Cockpit (Structure, notamment) — exclut Solo/Employeur qui ont déjà leurs propres
 * consoles dédiées (getSoloOrganisation/getEmployeurOrganisation). Un Fondateur qui
 * n'est membre d'aucune organisation de ce type reçoit `null` (les pages du Cockpit
 * lui restent accessibles via is_fondateur(), pas via cette résolution).
 */
export const getMonOrganisation = cache(async (): Promise<MonOrganisation | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('membres_organisations')
    .select('id, organisations(id, nom, type_organisation), roles_utilisateurs(role, actif)')
    .eq('profile_id', user.id)
    .eq('statut', 'actif')

  const membership = (data ?? []).find((m: any) => m.organisations && !['solo', 'employeur'].includes(m.organisations.type_organisation))
  if (!membership) return null

  const roles = ((membership as any).roles_utilisateurs ?? []).filter((r: any) => r.actif).map((r: any) => r.role)

  return {
    id: (membership as any).organisations.id,
    nom: (membership as any).organisations.nom,
    type_organisation: (membership as any).organisations.type_organisation,
    membre_organisation_id: (membership as any).id,
    roles,
  }
})
