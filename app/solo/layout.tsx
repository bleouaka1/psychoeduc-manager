import Link from 'next/link'
import { Repeat, LayoutDashboard, HeartHandshake } from 'lucide-react'
import { logout } from '../login/actions'
import { getSoloOrganisation, getIsFondateur } from './_lib/getSoloOrg'
import SoloSidebar from './_components/SoloSidebar'
import { NotificationsBell } from '@/app/_components/NotificationsBell'
import { compterMessagesNonLus } from '@/lib/messagerieInterne'
import { compteAAccesBeneficiaire } from '@/lib/comptes'
import { createClient } from '@/lib/supabase/server'
import { organisationApercuActive } from '@/lib/apercu'
import { ApercuBanner } from '@/app/(dashboard)/_components/ApercuBanner'
import { BoutonRetour } from '@/app/_components/BoutonRetour'

export default async function SoloLayout({ children }: { children: React.ReactNode }) {
  const [organisation, isFondateur, messagesNonLus, aAccesBeneficiaire] = await Promise.all([
    getSoloOrganisation(),
    getIsFondateur(),
    compterMessagesNonLus(),
    compteAAccesBeneficiaire(await createClient()),
  ])
  const apercu = isFondateur ? await organisationApercuActive() : null

  return (
    <div className="flex min-h-screen bg-bg-base overflow-x-hidden relative">
      <div className="ambient-halo" />
      <SoloSidebar messagesNonLus={messagesNonLus} />
      <div className="flex-1 min-w-0 relative z-[1] px-10 py-8">
        <div className="max-w-6xl mx-auto">
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
                <Link href="/dashboard" className="flex items-center gap-1 text-accent-gold hover:underline ml-2">
                  <LayoutDashboard size={13} /> Cockpit Fondateur
                </Link>
              )}
            </div>
            <div className="flex items-center gap-3">
              {aAccesBeneficiaire && (
                <Link href="/mon-espace" className="flex items-center gap-1 text-accent-gold hover:underline text-[13px]">
                  <HeartHandshake size={13} /> Mon espace bénéficiaire
                </Link>
              )}
              <NotificationsBell />
              <form action={logout}>
                <button type="submit" className="text-[13px] text-text-muted hover:text-danger transition-colors">
                  Déconnexion
                </button>
              </form>
            </div>
          </div>

          {apercu && <ApercuBanner organisation={apercu} />}

          <BoutonRetour masquerSur={['/solo']} />

          {organisation ? (
            children
          ) : (
            <div className="bg-bg-card border border-border-soft rounded-2xl p-10 text-center">
              <p className="font-display text-2xl text-text-primary mb-2">Aucun espace Solo</p>
              <p className="text-text-muted text-sm">Votre compte n’est rattaché à aucune organisation de type Solo pour le moment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
