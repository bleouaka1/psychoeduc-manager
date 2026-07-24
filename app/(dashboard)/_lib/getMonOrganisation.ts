import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { resoudreOrganisationApercu } from '@/lib/apercu'

export type MonOrganisation = {
  id: string
  nom: string
  type_organisation: string
  membre_organisation_id: string
  roles: string[]
}

// Mode Aperçu (`lib/apercu.ts`) : le Fondateur n'a réellement aucune ligne membres_organisations/
// roles_utilisateurs dans l'organisation prévisualisée — plutôt que de la lui fabriquer, on lui
// attribue le rôle le plus permissif de chaque page (déjà couvert par is_fondateur() côté RLS
// de toute façon) pour qu'il voie tous les formulaires/actions possibles, exactement ce que le
// mode Aperçu doit permettre de tester. `membre_organisation_id` reste un placeholder qui ne
// correspond à aucune ligne réelle : les quelques requêtes scopées dessus (ex. VueFormateur)
// renverront simplement vide, cas volontairement dégradé en aperçu (rôle de gouvernance déjà
// inclus dans ROLES_APERCU, la vue large — pas la vue Formateur — s'affichera).
const ROLES_APERCU = ['directeur', 'promoteur', 'coordinateur', 'educateur', 'formateur', 'administrateur']

/**
 * Résout l'organisation "de travail" du membre connecté pour les pages génériques du
 * Cockpit (Structure, notamment) — exclut Solo/Employeur qui ont déjà leurs propres
 * consoles dédiées (getSoloOrganisation/getEmployeurOrganisation). Un Fondateur qui
 * n'est membre d'aucune organisation de ce type reçoit `null` (les pages du Cockpit
 * lui restent accessibles via is_fondateur(), pas via cette résolution) — sauf s'il a
 * activé le mode Aperçu sur une organisation Structure, auquel cas elle prime.
 */
export const getMonOrganisation = cache(async (): Promise<MonOrganisation | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Tous les types valides (`organisations_type_organisation_check`) sauf solo/employeur —
  // même exclusion que le filtre plus bas (`!['solo','employeur'].includes(...)`), pour que
  // l'aperçu reste cohérent avec ce que cette fonction résout normalement.
  const apercu = await resoudreOrganisationApercu(supabase, ['structure', 'centre', 'ong', 'ecole', 'association', 'fondation', 'entreprise'])
  if (apercu) {
    return { id: apercu.id, nom: apercu.nom, type_organisation: apercu.type_organisation, membre_organisation_id: '00000000-0000-0000-0000-000000000000', roles: ROLES_APERCU }
  }

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
