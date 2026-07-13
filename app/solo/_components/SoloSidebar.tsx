'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  LayoutDashboard,
  Users,
  GraduationCap,
  Users2,
  CalendarClock,
  Store,
  Wallet,
  Inbox,
  IdCard,
  HeartHandshake,
  Settings,
  ChevronLeft,
  Archive,
  type LucideIcon,
} from 'lucide-react'

const NAV_SECTIONS: { label: string; items: { href: string; label: string; icon: LucideIcon; badge?: 'messagerie' }[] }[] = [
  {
    label: 'Vue d’ensemble',
    items: [
      { href: '/', label: 'Accueil', icon: Home },
      { href: '/solo', label: 'Vue générale', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Mon activité',
    items: [
      { href: '/solo/beneficiaires', label: 'Mes bénéficiaires', icon: Users },
      { href: '/solo/formations', label: 'Mes formations', icon: GraduationCap },
      { href: '/solo/cercles', label: 'Cercles', icon: Users2 },
      { href: '/solo/calendrier', label: 'Calendrier', icon: CalendarClock },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { href: '/solo/marketplace', label: 'Marketplace', icon: Store },
      { href: '/solo/revenus', label: 'Revenus', icon: Wallet },
    ],
  },
  {
    label: 'Communication',
    items: [{ href: '/solo/messagerie', label: 'Messagerie', icon: Inbox, badge: 'messagerie' }],
  },
  {
    label: 'Mon compte',
    items: [
      { href: '/solo/profil', label: 'Profil public', icon: IdCard },
      { href: '/devenir-beneficiaire', label: 'Devenir bénéficiaire', icon: HeartHandshake },
      { href: '/solo/archives', label: 'Archives', icon: Archive },
      { href: '/solo/parametres', label: 'Paramètres', icon: Settings },
    ],
  },
]

export default function SoloSidebar({ messagesNonLus = 0 }: { messagesNonLus?: number }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)

  return (
    <aside
      className={`print:hidden relative shrink-0 bg-bg-surface border-r border-border-soft flex flex-col gap-1 h-screen sticky top-0 overflow-y-auto overflow-x-hidden thin-scroll transition-[width,padding] duration-200 ease-out ${
        collapsed ? 'w-[76px] px-3 py-6' : 'w-[260px] px-4 py-6'
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
        className={`absolute top-[26px] -right-[16px] w-[32px] h-[32px] rounded-full bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base ring-4 ring-bg-base flex items-center justify-center z-20 shadow-[0_2px_10px_rgba(212,162,78,0.5)] transition-all duration-200 ease-out hover:scale-110 hover:shadow-[0_4px_18px_rgba(212,162,78,0.7)] active:scale-95 ${
          collapsed ? 'rotate-180' : ''
        }`}
      >
        <ChevronLeft size={16} strokeWidth={2.75} />
      </button>

      <div className={`flex items-center gap-2.5 mb-6 ${collapsed ? 'justify-center px-0' : 'px-2'}`}>
        <div className="w-[38px] h-[38px] shrink-0 rounded-[10px] bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center font-display font-bold text-bg-base text-base">
          P
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-display font-semibold text-[15px] text-text-primary">PsychoÉduc</p>
            <p className="text-[11px] text-text-muted">Compte Solo</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && <p className="text-[11px] uppercase tracking-wider text-text-muted px-3 mb-1.5">{section.label}</p>}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href
                const Icon = item.icon
                const badgeCount = item.badge === 'messagerie' ? messagesNonLus : 0
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-[10px] text-[13.5px] transition-colors ${
                      collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                    } ${active ? 'bg-gradient-to-r from-accent-gold/20 to-transparent text-text-primary border-l-2 border-accent-gold' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    <span className="relative shrink-0">
                      <Icon size={17} strokeWidth={2} />
                      {collapsed && badgeCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-[7px] h-[7px] rounded-full bg-danger" />}
                    </span>
                    {!collapsed && (
                      <span className="flex-1 flex items-center justify-between">
                        {item.label}
                        {badgeCount > 0 && (
                          <span className="bg-danger text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                            {badgeCount > 9 ? '9+' : badgeCount}
                          </span>
                        )}
                      </span>
                    )}

                    {collapsed && (
                      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-bg-card border border-border-soft px-2.5 py-1.5 text-xs text-text-primary opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 z-20">
                        {item.label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
