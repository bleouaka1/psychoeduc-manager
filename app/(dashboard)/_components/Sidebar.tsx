'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  LayoutDashboard,
  User,
  Building2,
  Briefcase,
  Users,
  Compass,
  CreditCard,
  Landmark,
  MessageCircle,
  Bot,
  ScrollText,
  LifeBuoy,
  Settings,
  BarChart2,
  ChevronLeft,
  Gauge,
  HeartHandshake,
  TrendingUp,
  Rocket,
  Store,
  CalendarDays,
  LineChart,
  type LucideIcon,
} from 'lucide-react'

const NAV_SECTIONS: { label: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Vue d’ensemble',
    items: [
      { href: '/', label: 'Accueil', icon: Home },
      { href: '/dashboard', label: 'Vue générale', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Clients',
    items: [
      { href: '/organisations/solo', label: 'Comptes Solo', icon: User },
      { href: '/organisations/structures', label: 'Structures', icon: Building2 },
      { href: '/organisations/employeurs', label: 'Employeurs', icon: Briefcase },
    ],
  },
  {
    label: 'Parcours',
    items: [
      { href: '/beneficiaires', label: 'Bénéficiaires', icon: Users },
      { href: '/iga', label: 'IGA', icon: Gauge },
      { href: '/capital-social', label: 'Capital social', icon: HeartHandshake },
      { href: '/agr', label: 'AGR', icon: TrendingUp },
      { href: '/insertion', label: 'Insertion professionnelle', icon: Rocket },
      { href: '/modules', label: 'Centre des modules', icon: Compass },
    ],
  },
  {
    label: 'Activité',
    items: [
      { href: '/licences', label: 'Licences & Abonnements', icon: CreditCard },
      { href: '/finances', label: 'Finances', icon: Landmark },
      { href: '/marketplace', label: 'Marketplace', icon: Store },
      { href: '/evenements', label: 'Événements', icon: CalendarDays },
      { href: '/intelligence-economique', label: 'Intelligence économique', icon: LineChart },
      { href: '/communication', label: 'Communication', icon: MessageCircle },
      { href: '/ia', label: 'Centre IA', icon: Bot },
    ],
  },
  {
    label: 'Gouvernance',
    items: [
      { href: '/audit', label: 'Journal d’audit', icon: ScrollText },
      { href: '/support', label: 'Support', icon: LifeBuoy },
      { href: '/parametres', label: 'Paramètres', icon: Settings },
      { href: '/statistiques', label: 'Statistiques', icon: BarChart2 },
    ],
  },
]

export default function Sidebar({ email }: { email?: string | null }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)

  return (
    <aside
      className={`relative shrink-0 bg-bg-surface border-r border-border-soft flex flex-col gap-1 h-screen sticky top-0 overflow-y-auto overflow-x-hidden thin-scroll transition-[width,padding] duration-200 ease-out ${
        collapsed ? 'w-[76px] px-3 py-6' : 'w-[260px] px-4 py-6'
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
        className={`absolute top-[22px] -right-[13px] w-[26px] h-[26px] rounded-full bg-bg-card border border-border-soft text-text-muted flex items-center justify-center z-10 transition-transform duration-200 hover:text-text-primary ${
          collapsed ? 'rotate-180' : ''
        }`}
      >
        <ChevronLeft size={13} />
      </button>

      <div className={`flex items-center gap-2.5 mb-6 ${collapsed ? 'justify-center px-0' : 'px-2'}`}>
        <div className="w-[38px] h-[38px] shrink-0 rounded-[10px] bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center font-display font-bold text-bg-base text-base">
          P
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-display font-semibold text-[15px] text-text-primary">PsychoÉduc</p>
            <p className="text-[11px] text-text-muted">Manager</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="text-[11px] uppercase tracking-wider text-text-muted px-3 mb-1.5">{section.label}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-[10px] text-[13.5px] transition-colors ${
                      collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                    } ${
                      active
                        ? 'bg-gradient-to-r from-accent-gold/20 to-transparent text-text-primary border-l-2 border-accent-gold'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon size={17} strokeWidth={2} className="shrink-0" />
                    {!collapsed && <span>{item.label}</span>}

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

      {!collapsed && email && (
        <div className="pt-4 mt-2 border-t border-border-soft">
          <p className="text-xs text-text-muted truncate px-2">{email}</p>
        </div>
      )}
    </aside>
  )
}
