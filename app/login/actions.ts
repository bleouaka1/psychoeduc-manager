'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { finaliserOrganisationEnAttente, finaliserAccesBeneficiaire, finaliserInvitationGenerale, resoudreDestinationConnexion } from '@/lib/comptes'

export type LoginState = { error?: string } | undefined

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Email et mot de passe requis.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Identifiants invalides.' }
  }

  await finaliserOrganisationEnAttente(supabase)
  await finaliserAccesBeneficiaire(supabase)
  await finaliserInvitationGenerale(supabase)
  redirect(await resoudreDestinationConnexion(supabase))
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
