'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMonOrganisation } from '../_lib/getMonOrganisation'

/**
 * Assigne un formateur à un bénéficiaire (§4.5) — c'est cette ligne, et elle seule, qui
 * ouvre l'accès du formateur au bénéficiaire (beneficiaires_select_formateur_assigne).
 * Périmètre fin ("Éducateur limité à sa propre cohorte") non appliqué ici — RLS
 * n'autorise déjà que Directeur/Coordinateur/Promoteur (peut_creer), la restriction
 * plus fine reste un gap V1 documenté dans DECISIONS_LOG.md.
 */
export async function assignerFormateur(formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const formateurMembreOrganisationId = String(formData.get('formateur_membre_organisation_id') ?? '')
  const beneficiaireId = String(formData.get('beneficiaire_id') ?? '')
  const roleAssignation = String(formData.get('role_assignation') ?? '').trim() || null
  if (!formateurMembreOrganisationId || !beneficiaireId) return

  const supabase = await createClient()
  await supabase.from('assignations').insert({
    organisation_id: organisation.id,
    formateur_membre_organisation_id: formateurMembreOrganisationId,
    beneficiaire_id: beneficiaireId,
    role_assignation: roleAssignation,
    assigne_par: organisation.membre_organisation_id,
  })

  revalidatePath('/assignations')
}

/** Fin d'assignation = date_fin renseignée (§4.5) — jamais un DELETE, l'historique
 * sert de base au calcul IPP (delta depuis la prise de responsabilité du formateur). */
export async function terminerAssignation(assignationId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('assignations').update({ date_fin: new Date().toISOString().slice(0, 10) }).eq('id', assignationId)
  revalidatePath('/assignations')
}
