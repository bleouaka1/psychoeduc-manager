import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { destinationOrganisationActive } from '@/lib/comptes'
import { logout } from '../login/actions'

export default async function MonEspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { count } = await supabase.from('beneficiaires').select('id', { count: 'exact', head: true }).eq('profile_id', user.id)
  if (!count) redirect('/login')

  // Bascule multi-profils (CLAUDE-CODE-COMPTES-MULTIPROFILS.md) : un même profil peut
  // cumuler une organisation ET un dossier bénéficiaire — bascule gratuite, instantanée,
  // ne déclenche jamais de test IGA ni aucune action de paiement (elle ne touche à rien
  // d'autre qu'un lien de navigation).
  const destinationOrg = await destinationOrganisationActive(supabase)

  return (
    <div className="mon-espace-theme min-h-screen bg-bg-base relative overflow-x-hidden">
      <div className="ambient-halo" />
      <div className="relative z-[1] px-6 sm:px-10 py-7 max-w-3xl mx-auto border-b border-border-soft flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[38px] h-[38px] rounded-[9px] bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center font-cinzel font-bold text-bg-base text-sm">
            PM
          </div>
          <p className="font-data text-[11px] tracking-[0.12em] text-text-muted uppercase">PsychoÉduc Manager</p>
        </div>
        <div className="flex items-center gap-6 text-[13px]">
          {destinationOrg && (
            <a href={destinationOrg} className="text-accent-gold hover:underline">
              Basculer vers mon espace organisation
            </a>
          )}
          <form action={logout}>
            <button type="submit" className="text-text-muted hover:text-danger transition-colors">
              Déconnexion
            </button>
          </form>
        </div>
      </div>

      <div className="relative z-[1] px-6 sm:px-10 py-11 max-w-3xl mx-auto">{children}</div>

      <footer className="relative z-[1] max-w-3xl mx-auto px-6 sm:px-10 pb-12 pt-6 mt-6 border-t border-border-soft text-center">
        <p className="font-data text-[10.5px] tracking-[0.1em] text-text-muted uppercase">
          <span className="text-accent-gold">PsychoÉduc Manager</span> — Mon espace bénéficiaire
        </p>
      </footer>
    </div>
  )
}
