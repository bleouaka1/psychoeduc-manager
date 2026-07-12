import Link from 'next/link'
import { Search, Bell, MessageSquare, Repeat, HeartHandshake } from 'lucide-react'
import { logout } from '../../login/actions'
import { compterMessagesNonLus } from '@/lib/messagerieInterne'
import { compteAAccesBeneficiaire } from '@/lib/comptes'
import { createClient } from '@/lib/supabase/server'

export default async function Topbar({ email }: { email?: string | null }) {
  const [nonLus, aAccesBeneficiaire] = await Promise.all([compterMessagesNonLus(), compteAAccesBeneficiaire(await createClient())])

  return (
    <header className="flex items-center gap-4 px-8 py-4 relative z-10">
      <div className="flex-1 flex items-center gap-2.5 bg-bg-card border border-border-soft rounded-xl px-4 py-3 max-w-xl">
        <Search size={16} className="text-text-muted shrink-0" />
        <input
          type="text"
          placeholder="Rechercher un client, une structure, un bénéficiaire, une licence…"
          className="bg-transparent outline-none text-[13.5px] text-text-primary placeholder:text-text-muted flex-1"
        />
      </div>

      <Link
        href="/solo"
        className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-accent-gold border border-border-soft rounded-full px-3.5 py-2 transition-colors"
      >
        <Repeat size={13} /> Mon espace Solo
      </Link>
      {aAccesBeneficiaire && (
        <Link
          href="/mon-espace"
          className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-accent-gold border border-border-soft rounded-full px-3.5 py-2 transition-colors"
        >
          <HeartHandshake size={13} /> Mon espace bénéficiaire
        </Link>
      )}

      <button
        type="button"
        className="w-[38px] h-[38px] rounded-[10px] bg-bg-card border border-border-soft flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
      </button>
      <Link
        href="/messagerie"
        className="relative w-[38px] h-[38px] rounded-[10px] bg-bg-card border border-border-soft flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        aria-label="Messagerie interne"
      >
        <MessageSquare size={16} />
        {nonLus > 0 && (
          <span className="absolute -top-1 -right-1 bg-danger text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {nonLus > 9 ? '9+' : nonLus}
          </span>
        )}
      </Link>

      <div className="flex items-center gap-2.5 pl-2">
        <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-accent-teal to-accent-teal-dim flex items-center justify-center text-sm font-semibold text-bg-base">
          {email?.[0]?.toUpperCase() ?? 'F'}
        </div>
        <form action={logout}>
          <button type="submit" className="text-[13px] text-text-muted hover:text-danger transition-colors px-2">
            Déconnexion
          </button>
        </form>
      </div>
    </header>
  )
}
