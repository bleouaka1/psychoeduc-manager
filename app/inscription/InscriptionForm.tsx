'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { creerCompte } from './actions'
import type { TypeCompteInscriptible } from '@/lib/comptes'

const TYPES_COMPTE: { valeur: TypeCompteInscriptible; label: string; description: string }[] = [
  { valeur: 'solo', label: 'Praticien indépendant (Solo)', description: 'Éducateur, psychologue, formateur, coach — vous exercez seul.' },
  { valeur: 'structure', label: 'Structure', description: 'École, ONG, association, cabinet — vous coordonnez plusieurs accompagnants.' },
  { valeur: 'employeur', label: 'Employeur', description: "Entreprise partenaire d'un parcours d'insertion." },
]

export function InscriptionForm() {
  const searchParams = useSearchParams()
  const typeParDefaut = searchParams.get('type')
  const typeInitial: TypeCompteInscriptible = TYPES_COMPTE.some((t) => t.valeur === typeParDefaut) ? (typeParDefaut as TypeCompteInscriptible) : 'solo'

  const [state, action, pending] = useActionState(creerCompte, undefined)

  if (state?.confirmationRequise) {
    return (
      <div className="relative z-[1] w-[400px] bg-bg-card border border-border-soft rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center font-display font-bold text-bg-base text-2xl mb-4 mx-auto">
          PM
        </div>
        <h1 className="font-display text-text-primary text-[20px] mb-2">Vérifiez votre boîte mail</h1>
        <p className="text-text-muted text-sm">
          Un e-mail de confirmation vous a été envoyé. Une fois votre compte confirmé,{' '}
          <Link href="/login" className="text-accent-gold hover:underline">
            connectez-vous
          </Link>{' '}
          pour accéder à votre espace.
        </p>
      </div>
    )
  }

  return (
    <form
      action={action}
      className="relative z-[1] w-[400px] bg-bg-card border border-border-soft rounded-2xl p-8 flex flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center font-display font-bold text-bg-base text-2xl mb-4">
        PM
      </div>
      <h1 className="font-display text-text-primary text-[22px] mb-1">Créer un compte</h1>
      <p className="text-text-muted text-sm mb-6">Rejoignez PsychoÉduc Manager.</p>

      <label className="text-text-primary/90 text-[13px] mb-2">Type de compte</label>
      <div className="flex flex-col gap-2 mb-4">
        {TYPES_COMPTE.map((t) => (
          <label
            key={t.valeur}
            className="flex items-start gap-2.5 bg-bg-surface border border-border-soft rounded-xl px-3 py-2.5 cursor-pointer has-[:checked]:border-accent-gold-dim"
          >
            <input type="radio" name="type_organisation" value={t.valeur} defaultChecked={t.valeur === typeInitial} className="mt-1 accent-current" />
            <span>
              <span className="block text-text-primary text-[13.5px] font-medium">{t.label}</span>
              <span className="block text-text-muted text-[11.5px] mt-0.5">{t.description}</span>
            </span>
          </label>
        ))}
      </div>

      <label htmlFor="organisation_nom" className="text-text-primary/90 text-[13px] mb-1.5">
        Nom (vous-même, ou votre structure/entreprise)
      </label>
      <input
        id="organisation_nom"
        name="organisation_nom"
        type="text"
        required
        className="bg-bg-surface border border-border-soft rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none focus:border-accent-gold-dim mb-3"
      />

      <label htmlFor="email" className="text-text-primary/90 text-[13px] mb-1.5">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        suppressHydrationWarning
        className="bg-bg-surface border border-border-soft rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none focus:border-accent-gold-dim mb-3"
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
        {pending ? 'Création...' : 'Créer mon compte'}
      </button>

      <p className="text-text-muted text-[12.5px] mt-4 text-center">
        Déjà un compte ?{' '}
        <Link href="/login" className="text-accent-gold hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  )
}
