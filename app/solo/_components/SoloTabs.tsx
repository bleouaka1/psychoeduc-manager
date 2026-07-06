'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, GraduationCap, Wallet, IdCard, CalendarClock, Store, type LucideIcon } from 'lucide-react'

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/solo', label: 'Vue générale', icon: LayoutDashboard },
  { href: '/solo/beneficiaires', label: 'Mes bénéficiaires', icon: Users },
  { href: '/solo/formations', label: 'Mes formations', icon: GraduationCap },
  { href: '/solo/marketplace', label: 'Marketplace', icon: Store },
  { href: '/solo/calendrier', label: 'Calendrier', icon: CalendarClock },
  { href: '/solo/revenus', label: 'Revenus', icon: Wallet },
  { href: '/solo/profil', label: 'Profil public', icon: IdCard },
]

export default function SoloTabs() {
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
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13.5px] border-b-2 -mb-px transition-colors ${
              active ? 'text-accent-gold border-accent-gold' : 'text-text-muted border-transparent hover:text-text-primary'
            }`}
          >
            <Icon size={15} />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
