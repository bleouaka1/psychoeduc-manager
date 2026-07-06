import Link from 'next/link'
import {
  Compass,
  Gauge,
  HeartHandshake,
  TrendingUp,
  Rocket,
  Store,
  CalendarDays,
  LineChart,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable } from '../_components/ui'

const MODULES_DETAIL: { href: string; label: string; desc: string; icon: LucideIcon }[] = [
  { href: '/iga', label: 'IGA', desc: 'Indice Général d’Autonomie — évaluations, référentiel, classement.', icon: Gauge },
  { href: '/capital-social', label: 'Capital social', desc: 'Réseau de soutien, personnes ressources, évaluations.', icon: HeartHandshake },
  { href: '/agr', label: 'AGR', desc: 'Activités Génératrices de Revenus des bénéficiaires.', icon: TrendingUp },
  { href: '/insertion', label: 'Insertion professionnelle', desc: 'Offres, candidatures, insertions, entreprises partenaires.', icon: Rocket },
  { href: '/marketplace', label: 'Marketplace', desc: 'Formations, services et produits publiés par la communauté.', icon: Store },
  { href: '/evenements', label: 'Événements', desc: 'Événements gratuits et payants de la plateforme.', icon: CalendarDays },
  { href: '/intelligence-economique', label: 'Intelligence économique', desc: 'Opportunités, concours, bourses, financements, analyses.', icon: LineChart },
]

export default async function ModulesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vue_dashboard_modules')
    .select('*')
    .order('nb_organisations_actives', { ascending: false })

  return (
    <>
      <PageHeader eyebrowIcon={Compass} eyebrowText="Parcours" title="Centre des modules" subtitle="Détail des modules du parcours bénéficiaire et activation par organisation." />

      <Panel title="Accès rapide aux modules" className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {MODULES_DETAIL.map((m) => {
            const Icon = m.icon
            return (
              <Link
                key={m.href}
                href={m.href}
                className="flex items-start gap-3 bg-bg-surface border border-border-soft rounded-xl p-4 hover:border-accent-gold-dim transition-colors"
              >
                <div className="w-9 h-9 shrink-0 rounded-[9px] bg-accent-gold/10 flex items-center justify-center">
                  <Icon size={16} className="text-accent-gold" />
                </div>
                <div>
                  <p className="text-text-primary text-sm font-medium">{m.label}</p>
                  <p className="text-text-muted text-xs mt-0.5">{m.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </Panel>

      <Panel title="Modules actifs par organisation">
        <DataTable
          columns={['Module', 'Organisations actives']}
          rows={(data ?? []).map((m: any) => [m.module, m.nb_organisations_actives])}
          emptyText="Aucun module activé pour le moment."
        />
      </Panel>
    </>
  )
}
