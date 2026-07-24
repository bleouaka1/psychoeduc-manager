import Link from 'next/link'
import { Home, Repeat, HeartHandshake } from 'lucide-react'
import { logout } from '../login/actions'
import { getEmployeurOrganisation } from './_lib/getEmployeurOrg'
import { createClient } from '@/lib/supabase/server'
import { organisationApercuActive } from '@/lib/apercu'
import { ApercuBanner } from '@/app/(dashboard)/_components/ApercuBanner'

export default async function EmployeurLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const [organisation, { data: estFondateur }] = await Promise.all([getEmployeurOrganisation(), supabase.rpc('is_fondateur')])
  const apercu = estFondateur ? await organisationApercuActive() : null

  return (
    <div className="min-h-screen bg-bg-base relative overflow-x-hidden">
      <div className="ambient-halo" />
      <div className="relative z-[1] px-10 py-8 max-w-6xl mx-auto">
        <div className="print:hidden flex items-center justify-between mb-7">
          <div className="flex items-center gap-2.5 bg-bg-card border border-border-soft rounded-xl px-3.5 py-2 text-[13px] text-text-muted">
            <Repeat size={14} />
            Contexte : <strong className="text-text-primary">{organisation?.nom ?? 'Mon espace Employeur'}</strong>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1 text-[13px] text-text-muted hover:text-text-primary transition-colors">
              <Home size={14} /> Accueil
            </Link>
            <Link href="/devenir-beneficiaire" className="flex items-center gap-1 text-[13px] text-text-muted hover:text-text-primary transition-colors">
              <HeartHandshake size={14} /> Devenir bénéficiaire
            </Link>
            <form action={logout}>
              <button type="submit" className="text-[13px] text-text-muted hover:text-danger transition-colors">
                Déconnexion
              </button>
            </form>
          </div>
        </div>

        {apercu && <ApercuBanner organisation={apercu} />}

        {organisation ? (
          children
        ) : (
          <div className="bg-bg-card border border-border-soft rounded-2xl p-10 text-center">
            <p className="font-display text-2xl text-text-primary mb-2">Aucun espace Employeur</p>
            <p className="text-text-muted text-sm">Votre compte n'est rattaché à aucune organisation de type Employeur pour le moment.</p>
          </div>
        )}
      </div>
    </div>
  )
}
