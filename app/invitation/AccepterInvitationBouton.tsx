'use client'

import { useState, useTransition } from 'react'
import { accepterInvitationConnecte } from './actions'

export function AccepterInvitationBouton({ token }: { token: string }) {
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await accepterInvitationConnecte(token)
            if (res.error) setErreur(res.error)
          })
        }
        className="w-full bg-accent-gold text-bg-base rounded-2xl py-3 font-bold text-[15px] cursor-pointer hover:brightness-105 transition disabled:opacity-60"
      >
        {isPending ? 'Traitement...' : "Accepter l'invitation"}
      </button>
      {erreur && <p className="text-danger text-[13px] mt-3">{erreur}</p>}
    </>
  )
}
