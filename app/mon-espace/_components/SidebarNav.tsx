'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Compass,
  Award,
  GraduationCap,
  MessageCircle,
  BookOpen,
  Briefcase,
  LineChart,
  Store,
  Target,
  FileStack,
  Users2,
  Users,
  FileText,
  CreditCard,
  Settings,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Navigation complète du dashboard bénéficiaire — sidebar desktop + tiroir mobile
 * partagent ce même composant (dashboard bénéficiaire v3, Lot G). Certains libellés
 * du modèle visuel de référence correspondent à des routes déjà existantes sous un
 * autre nom (« Espace d'apprentissage »/« Documents » pointent vers des écrans déjà
 * construits — Marketplace/Révisions — plutôt que dupliqués) ; toutes les routes déjà
 * présentes avant ce lot (Cercles, Capital social, CV, Abonnement) restent listées,
 * aucune ne disparaît de la navigation.
 */
const NAV_ITEMS = [
  { label: 'Tableau de bord', suffix: '', icon: Home },
  { label: 'Mon IGA', suffix: '#boussole', icon: Compass },
  { label: 'Mes compétences', suffix: '#profil-professionnel', icon: Award },
  { label: "Espace d'apprentissage", suffix: 'marketplace', icon: GraduationCap },
  { label: 'Espace Tuteurs', suffix: 'tuteurs', icon: MessageCircle },
  { label: 'Révisions & Quiz', suffix: 'revisions', icon: BookOpen },
  { label: 'Session professionnelle', suffix: 'insertion', icon: Briefcase },
  { label: 'Intelligence économique', suffix: 'intelligence-economique', icon: LineChart },
  { label: 'Marketplace', suffix: 'marketplace', icon: Store },
  { label: 'Mes objectifs', suffix: 'projets-vie', icon: Target },
  { label: 'Documents', suffix: 'revisions', icon: FileStack },
  { label: 'Cercles d’apprentissage', suffix: 'cercles', icon: Users },
  { label: 'Mon capital social', suffix: 'capital-social', icon: Users2 },
  { label: 'Mon CV', suffix: 'cv', icon: FileText },
  { label: 'Mon abonnement', suffix: 'abonnement', icon: CreditCard },
  { label: 'Paramètres & Accessibilité', suffix: 'parametres', icon: Settings },
] as const

type Profil = { nom: string; prenoms: string; solde: number }

export function SidebarNav({ variant = 'desktop' }: { variant?: 'desktop' | 'drawer' }) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const beneficiaireId = segments.length >= 2 ? segments[1] : null
  const sousChemin = segments.slice(2).join('/')

  const [profil, setProfil] = useState<Profil | null>(null)

  useEffect(() => {
    if (!beneficiaireId) return
    const supabase = createClient()
    let annule = false
    async function charger() {
      const [{ data: beneficiaire }, { data: credits }] = await Promise.all([
        supabase.from('beneficiaires').select('nom, prenoms').eq('id', beneficiaireId).maybeSingle(),
        supabase.from('credits_revision').select('solde').eq('beneficiaire_id', beneficiaireId).maybeSingle(),
      ])
      if (annule) return
      if (beneficiaire) setProfil({ nom: beneficiaire.nom, prenoms: beneficiaire.prenoms, solde: credits?.solde ?? 0 })
    }
    charger()
    return () => {
      annule = true
    }
  }, [beneficiaireId])

  if (!beneficiaireId) return null

  const base = `/mon-espace/${beneficiaireId}`

  return (
    <div className="flex flex-col h-full">
      {profil && (
        <div className="bg-bg-surface border border-border-soft rounded-xl p-3 flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center font-cinzel font-bold text-bg-base text-[13px] shrink-0">
            {profil.prenoms?.[0]}
            {profil.nom?.[0]}
          </div>
          <div className="min-w-0">
            <p className="text-text-primary text-[12.5px] font-medium truncate">{profil.prenoms}</p>
            <p className="text-text-muted text-[10px]">Bénéficiaire</p>
            <p className="text-accent-gold text-[10.5px] font-semibold mt-0.5">💰 {profil.solde} crédits</p>
          </div>
        </div>
      )}

      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const estAncre = item.suffix.startsWith('#')
          const href = item.suffix === '' ? base : estAncre ? `${base}${item.suffix}` : `${base}/${item.suffix}`
          const actif = !estAncre && (item.suffix === '' ? sousChemin === '' : sousChemin === item.suffix || sousChemin.startsWith(`${item.suffix}/`))
          return (
            <Link
              key={`${variant}-${item.label}`}
              href={href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] transition-colors ${
                actif ? 'bg-accent-gold/10 text-accent-gold font-medium' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
