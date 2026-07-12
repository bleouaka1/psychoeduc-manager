'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { finaliserAccesBeneficiaire, resoudreDestinationConnexion } from '@/lib/comptes'

export type InscriptionBeneficiaireState = { error?: string; confirmationRequise?: boolean } | undefined

/** Miroir de app/inscription/actions.ts::creerCompte, pour le parcours bénéficiaire
 * invité (CLAUDE-CODE-COMPTES-MULTIPROFILS.md). Le token est conservé en
 * user_metadata pour que finaliserAccesBeneficiaire() puisse rattacher la fiche
 * bénéficiaire une fois la session confirmée (même mécanique que
 * finaliserOrganisationEnAttente pour /inscription). */
export async function creerCompteBeneficiaire(_prevState: InscriptionBeneficiaireState, formData: FormData): Promise<InscriptionBeneficiaireState> {
  const token = String(formData.get('token') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!token || !email || !password) {
    return { error: 'Tous les champs sont requis.' }
  }
  if (password.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères.' }
  }

  const supabase = await createClient()

  const { data: invitations } = await supabase.rpc('consulter_invitation_beneficiaire', { p_token: token })
  const invitation = (invitations as any)?.[0] as { email: string; prenom: string | null; valide: boolean } | undefined
  if (!invitation || !invitation.valide || invitation.email !== email) {
    return { error: 'Cette invitation est invalide ou a expiré.' }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { invitation_beneficiaire_token: token } },
  })

  if (error) {
    const message = error.message.toLowerCase().includes('already registered') ? 'Un compte existe déjà avec cet email.' : 'Impossible de créer le compte pour le moment.'
    return { error: message }
  }
  if (!data.user) {
    return { error: 'Impossible de créer le compte pour le moment.' }
  }

  if (!data.session) {
    return { confirmationRequise: true }
  }

  await finaliserAccesBeneficiaire(supabase)
  redirect(await resoudreDestinationConnexion(supabase))
}
