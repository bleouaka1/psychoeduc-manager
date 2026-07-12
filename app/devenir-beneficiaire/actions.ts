'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Un compte existant (Fondateur, Formateur, tout type) devient bénéficiaire d'un
 * AUTRE praticien, en autonomie — cas d'usage initial du document
 * (CLAUDE-CODE-COMPTES-MULTIPROFILS.md §1 : "un praticien dans son propre système").
 * Aucune ligne membres_organisations créée (même principe que le reste de cette
 * fonctionnalité) : juste un dossier beneficiaires de plus, profile_id = soi-même,
 * sous l'organisation choisie. RLS déjà ouverte (beneficiaires_insert, migration
 * 20260726010000). Le test IGA obligatoire (§4.1 du document) n'est pas
 * auto-administré ici : comme partout ailleurs dans ce projet, une évaluation IGA
 * est toujours conduite par un praticien, jamais un auto-questionnaire — le nouveau
 * dossier attend simplement que ce praticien programme la première évaluation. */
export async function devenirBeneficiaireAction(organisationId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { count } = await supabase.from('beneficiaires').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).eq('organisation_id', organisationId)
  if ((count ?? 0) > 0) return

  const { data: profile } = await supabase.from('profiles').select('nom, prenoms, email, telephone').eq('id', user.id).maybeSingle()

  const { data: nouveau, error } = await supabase
    .from('beneficiaires')
    .insert({
      organisation_id: organisationId,
      profile_id: user.id,
      nom: profile?.nom || 'Bénéficiaire',
      prenoms: profile?.prenoms || '',
      email: profile?.email,
      telephone: profile?.telephone,
      statut_beneficiaire: 'actif',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !nouveau) return

  redirect(`/mon-espace/${nouveau.id}`)
}
