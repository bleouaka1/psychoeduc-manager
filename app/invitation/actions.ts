'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { finaliserInvitationGenerale, resoudreDestinationConnexion } from '@/lib/comptes'

export type InvitationState = { error?: string; confirmationRequise?: boolean } | undefined

/** Créer un compte à partir d'une invitation §4.4 (membre d'équipe ou parent/tuteur) —
 * miroir de app/inscription-beneficiaire/actions.ts::creerCompteBeneficiaire. */
export async function creerCompteDepuisInvitation(_prevState: InvitationState, formData: FormData): Promise<InvitationState> {
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

  const { data: invitations } = await supabase.rpc('consulter_invitation', { p_token: token })
  const invitation = (invitations as any)?.[0] as { email: string; valide: boolean } | undefined
  if (!invitation || !invitation.valide || invitation.email !== email) {
    return { error: 'Cette invitation est invalide ou a expiré.' }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { invitation_generale_token: token } },
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

  await finaliserInvitationGenerale(supabase)
  redirect(await resoudreDestinationConnexion(supabase))
}

/** Accepter l'invitation avec un compte déjà existant (déjà connecté). */
export async function accepterInvitationConnecte(token: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Vous devez être connecté.' }

  const { data: succesEquipe } = await supabase.rpc('finaliser_acces_membre_equipe', { p_token: token })
  const { data: succesParent } = await supabase.rpc('finaliser_acces_parent', { p_token: token })

  if (!succesEquipe && !succesParent) {
    return { error: 'Cette invitation est invalide, expirée, ou ne correspond pas à votre compte.' }
  }

  redirect(await resoudreDestinationConnexion(supabase))
}
