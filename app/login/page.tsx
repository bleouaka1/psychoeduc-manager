'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-base relative overflow-hidden">
      <div className="ambient-halo" />
      <form
        action={action}
        className="relative z-[1] w-[360px] bg-bg-card border border-border-soft rounded-2xl p-8 flex flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center font-display font-bold text-bg-base text-2xl mb-4">
          PM
        </div>
        <h1 className="font-display text-text-primary text-[22px] mb-1">PsychoÉduc Manager</h1>
        <p className="text-text-muted text-sm mb-6">Connexion au Cockpit Fondateur</p>

        <label htmlFor="email" className="text-text-primary/90 text-[13px] mb-1.5 mt-3">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          suppressHydrationWarning
          className="bg-bg-surface border border-border-soft rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none focus:border-accent-gold-dim"
        />

        <label htmlFor="password" className="text-text-primary/90 text-[13px] mb-1.5 mt-3">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          suppressHydrationWarning
          className="bg-bg-surface border border-border-soft rounded-xl px-3 py-2.5 text-text-primary text-sm outline-none focus:border-accent-gold-dim"
        />

        {state?.error && <p className="text-danger text-[13px] mt-3">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 bg-accent-gold text-bg-base rounded-2xl py-3 font-bold text-[15px] cursor-pointer hover:brightness-105 transition disabled:opacity-60"
        >
          {pending ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </main>
  )
}
