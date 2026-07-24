import { UserCog } from 'lucide-react'
import { quitterImpersonation } from '../apercu/actions'

export function ImpersonationBanner() {
  return (
    <div className="print:hidden flex items-center justify-between gap-3 bg-gradient-to-r from-accent-gold/20 to-transparent border border-accent-gold/40 rounded-xl px-4 sm:px-6 py-2.5 mb-2 mx-auto max-w-3xl text-[13px]">
      <span className="flex items-center gap-2 text-text-primary">
        <UserCog size={15} className="text-accent-gold" />
        Impersonation Fondateur en cours — vous êtes connecté en tant que ce compte, données réelles.
      </span>
      <form action={quitterImpersonation}>
        <button type="submit" className="text-accent-gold hover:underline font-medium whitespace-nowrap">
          Quitter l'impersonation
        </button>
      </form>
    </div>
  )
}
