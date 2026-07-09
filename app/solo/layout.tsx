import Link from 'next/link'
import { Repeat, LayoutDashboard } from 'lucide-react'
import { logout } from '../login/actions'
import { getSoloOrganisation, getIsFondateur } from './_lib/getSoloOrg'
import SoloTabs from './_components/SoloTabs'
import { NotificationsBell } from './_components/NotificationsBell'
import { compterMessagesNonLus } from '@/lib/messagerieInterne'

export default async function SoloLayout({ children }: { children: React.ReactNode }) {
  const [organisation, isFondateur, messagesNonLus] = await Promise.all([getSoloOrganisation(), getIsFondateur(), compterMessagesNonLus()])

  return (
    <div className="min-h-screen bg-bg-base relative overflow-x-hidden">
      <div className="ambient-halo" />
      <div className="relative z-[1] px-10 py-8 max-w-6xl mx-auto">
        <div className="print:hidden flex items-center justify-between mb-7">
          <div className="flex items-center gap-2.5 bg-bg-card border border-border-soft rounded-xl px-3.5 py-2 text-[13px] text-text-muted">
            <Repeat size={14} />
            Contexte : <strong className="text-text-primary">{organisation?.nom ?? 'Mon espace Solo'}</strong>
            {isFondateur && (
              <span className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base text-[10.5px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                FONDATEUR
              </span>
            )}
            {isFondateur && (
              <Link href="/" className="flex items-center gap-1 text-accent-gold hover:underline ml-2">
                <LayoutDashboard size={13} /> Cockpit Fondateur
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <form action={logout}>
              <button type="submit" className="text-[13px] text-text-muted hover:text-danger transition-colors">
                Déconnexion
              </button>
            </form>
          </div>
        </div>

        {organisation ? (
          <>
            <SoloTabs messagesNonLus={messagesNonLus} />
            {children}
          </>
        ) : (
          <div className="bg-bg-card border border-border-soft rounded-2xl p-10 text-center">
            <p className="font-display text-2xl text-text-primary mb-2">Aucun espace Solo</p>
            <p className="text-text-muted text-sm">
              Votre compte n’est rattaché à aucune organisation de type Solo pour le moment.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
