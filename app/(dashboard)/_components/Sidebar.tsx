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
  Archive,
  UserCog,
  UserPlus,
  CalendarCheck,
  FolderCheck,
  Wallet,
  Receipt,
  Settings2,
  FileBarChart,
  Eye,
  type LucideIcon,
} from 'lucide-react'

const NAV_SECTIONS: { label: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Vue d’ensemble',
    items: [
      { href: '/', label: 'Accueil', icon: Home },
      { href: '/dashboard', label: 'Vue générale', icon: LayoutDashboard },
      { href: '/devenir-beneficiaire', label: 'Devenir bénéficiaire', icon: Compass },
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
      { href: '/assignations', label: 'Assignations', icon: UserCog },
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
      { href: '/etablissements', label: 'Établissements', icon: Building2 },
      { href: '/invitations', label: 'Invitations', icon: UserPlus },
      { href: '/parametres-organisation', label: 'Paramètres organisation', icon: Settings2 },
      { href: '/archives', label: 'Archives', icon: Archive },
      { href: '/audit', label: 'Journal d’audit', icon: ScrollText },
      { href: '/rapport-impact', label: 'Rapport d’impact', icon: FileBarChart },
      { href: '/support', label: 'Support', icon: LifeBuoy },
      { href: '/parametres', label: 'Paramètres', icon: Settings },
      { href: '/statistiques', label: 'Statistiques', icon: BarChart2 },
    ],
  },
]

// §4.1/§5 : n'apparaît dans le DOM que si l'organisation a activé le module (ou pour le
// Fondateur, toujours) — jamais grisé, absent purement et simplement sinon.
const SECTION_GESTION_ADMINISTRATIVE = {
  label: 'Gestion Administrative',
  items: [
    { href: '/presences', label: 'Présences', icon: CalendarCheck },
    { href: '/dossiers', label: 'Dossiers', icon: FolderCheck },
    { href: '/paiements', label: 'Paiements', icon: Wallet },
    { href: '/factures', label: 'Facturation', icon: Receipt },
  ],
}

export default function Sidebar({
  email,
  moduleAdminActif = false,
  estFondateur = false,
}: {
  email?: string | null
  moduleAdminActif?: boolean
  estFondateur?: boolean
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)
  let sections = moduleAdminActif ? [...NAV_SECTIONS.slice(0, 3), SECTION_GESTION_ADMINISTRATIVE, ...NAV_SECTIONS.slice(3)] : NAV_SECTIONS
  // Mode Aperçu ("voir en tant que", lib/apercu.ts) : jamais visible pour un compte non-Fondateur.
  if (estFondateur) {
    sections = sections.map((section) =>
      section.label === 'Vue d’ensemble' ? { ...section, items: [...section.items, { href: '/apercu', label: 'Mode Test — Aperçu', icon: Eye }] } : section,
    )
  }

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
            <p className="text-[11px] text-text-muted">Manager</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5">
        {sections.map((section) => (
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
