'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, GraduationCap, Wallet, IdCard, CalendarClock, Store, Settings, Inbox, type LucideIcon } from 'lucide-react'

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/solo', label: 'Vue générale', icon: LayoutDashboard },
  { href: '/solo/beneficiaires', label: 'Mes bénéficiaires', icon: Users },
  { href: '/solo/formations', label: 'Mes formations', icon: GraduationCap },
  { href: '/solo/marketplace', label: 'Marketplace', icon: Store },
  { href: '/solo/messagerie', label: 'Messagerie', icon: Inbox },
  { href: '/solo/calendrier', label: 'Calendrier', icon: CalendarClock },
  { href: '/solo/revenus', label: 'Revenus', icon: Wallet },
  { href: '/solo/profil', label: 'Profil public', icon: IdCard },
  { href: '/solo/parametres', label: 'Paramètres', icon: Settings },
]

export default function SoloTabs({ messagesNonLus = 0 }: { messagesNonLus?: number }) {
  const pathname = usePathname()

  return (
    <nav className="print:hidden flex gap-1.5 border-b border-border-soft mb-7">
      {TABS.map((tab) => {
        const active = pathname === tab.href
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex items-center gap-1.5 px-4 py-2.5 text-[13.5px] border-b-2 -mb-px transition-colors ${
              active ? 'text-accent-gold border-accent-gold' : 'text-text-muted border-transparent hover:text-text-primary'
            }`}
          >
            <Icon size={15} />
            {tab.label}
            {tab.href === '/solo/messagerie' && messagesNonLus > 0 && (
              <span className="bg-danger text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {messagesNonLus > 9 ? '9+' : messagesNonLus}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
