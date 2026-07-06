import { Repeat } from 'lucide-react'
import { logout } from '../login/actions'
import { getEmployeurOrganisation } from './_lib/getEmployeurOrg'

export default async function EmployeurLayout({ children }: { children: React.ReactNode }) {
  const organisation = await getEmployeurOrganisation()

  return (
    <div className="min-h-screen bg-bg-base relative overflow-x-hidden">
      <div className="ambient-halo" />
      <div className="relative z-[1] px-10 py-8 max-w-6xl mx-auto">
        <div className="print:hidden flex items-center justify-between mb-7">
          <div className="flex items-center gap-2.5 bg-bg-card border border-border-soft rounded-xl px-3.5 py-2 text-[13px] text-text-muted">
            <Repeat size={14} />
            Contexte : <strong className="text-text-primary">{organisation?.nom ?? 'Mon espace Employeur'}</strong>
          </div>
          <form action={logout}>
            <button type="submit" className="text-[13px] text-text-muted hover:text-danger transition-colors">
              Déconnexion
            </button>
          </form>
        </div>

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
