'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { creerCompteDepuisInvitation } from './actions'

const ROLE_LABEL: Record<string, string> = {
  directeur: 'Directeur',
  coordinateur: 'Coordinateur',
  educateur: 'Éducateur',
  formateur: 'Formateur',
  promoteur: 'Promoteur',
  parent: 'Parent',
  tuteur: 'Tuteur',
}

export function InvitationForm({
  token,
  email,
  role_propose: rolePropose,
  organisation_nom: organisationNom,
  beneficiaire_nom: beneficiaireNom,
}: {
  token: string
  email: string
  role_propose: string
  organisation_nom: string
  beneficiaire_nom: string | null
}) {
  const [state, action, pending] = useActionState(creerCompteDepuisInvitation, undefined)

  if (state?.confirmationRequise) {
    return (
      <div className="relative z-[1] w-[400px] bg-bg-card border border-border-soft rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center font-display font-bold text-bg-base text-2xl mb-4 mx-auto">
          PM
        </div>
        <h1 className="font-display text-text-primary text-[20px] mb-2">Vérifiez votre boîte mail</h1>
        <p className="text-text-muted text-sm">
          Un e-mail de confirmation vous a été envoyé. Une fois confirmé,{' '}
          <Link href="/login" className="text-accent-gold hover:underline">
            connectez-vous
          </Link>{' '}
          pour rejoindre {organisationNom}.
        </p>
      </div>
    )
  }

  const contexte = beneficiaireNom
    ? `Vous êtes invité(e) en tant que ${ROLE_LABEL[rolePropose] ?? rolePropose} de ${beneficiaireNom}, chez ${organisationNom}.`
    : `Vous êtes invité(e) à rejoindre ${organisationNom} en tant que ${ROLE_LABEL[rolePropose] ?? rolePropose}.`

  return (
    <form
      action={action}
      className="relative z-[1] w-[400px] bg-bg-card border border-border-soft rounded-2xl p-8 flex flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
    >
      <input type="hidden" name="token" value={token} />
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center font-display font-bold text-bg-base text-2xl mb-4">
        PM
      </div>
      <h1 className="font-display text-text-primary text-[22px] mb-1">Créez votre accès</h1>
      <p className="text-text-muted text-sm mb-6">{contexte}</p>

      <label htmlFor="email" className="text-text-primary/90 text-[13px] mb-1.5">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        readOnly
        defaultValue={email}
        className="bg-bg-surface border border-border-soft rounded-xl px-3 py-2.5 text-text-muted text-sm outline-none mb-3 cursor-not-allowed"
      />

      <label htmlFor="password" className="text-text-primary/90 text-[13px] mb-1.5">
        Mot de passe
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        suppressHydrationWarning
        className="bg-bg-surface border border-border-soft rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none focus:border-accent-gold-dim"
      />

      {state?.error && <p className="text-danger text-[13px] mt-3">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 bg-accent-gold text-bg-base rounded-2xl py-3 font-bold text-[15px] cursor-pointer hover:brightness-105 transition disabled:opacity-60"
      >
        {pending ? 'Création...' : 'Créer mon accès'}
      </button>

      <p className="text-text-muted text-[12.5px] mt-4 text-center">
        Déjà un compte ?{' '}
        <Link href="/login" className="text-accent-gold hover:underline">
          Connectez-vous d&apos;abord
        </Link>
        , puis rouvrez ce lien.
      </p>
    </form>
  )
}
