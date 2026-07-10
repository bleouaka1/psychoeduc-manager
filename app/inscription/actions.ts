'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { finaliserOrganisationEnAttente, resoudreDestinationConnexion, TYPES_COMPTE_INSCRIPTIBLES, type TypeCompteInscriptible } from '@/lib/comptes'

export type InscriptionState = { error?: string; confirmationRequise?: boolean } | undefined

export async function creerCompte(_prevState: InscriptionState, formData: FormData): Promise<InscriptionState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const typeOrganisation = String(formData.get('type_organisation') ?? '')
  const organisationNom = String(formData.get('organisation_nom') ?? '').trim()

  if (!email || !password || !organisationNom) {
    return { error: 'Tous les champs sont requis.' }
  }
  if (!TYPES_COMPTE_INSCRIPTIBLES.includes(typeOrganisation as TypeCompteInscriptible)) {
    return { error: 'Merci de choisir un type de compte.' }
  }
  if (password.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Conservé dans user_metadata : l'organisation est créée juste en dessous si la session
    // est immédiate, sinon à la première connexion (cf. finaliserOrganisationEnAttente —
    // nécessaire si le projet Supabase exige une confirmation par e-mail avant toute session).
    options: { data: { type_organisation: typeOrganisation, organisation_nom: organisationNom } },
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

  await finaliserOrganisationEnAttente(supabase)
  redirect(await resoudreDestinationConnexion(supabase))
}
