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
    <div className="min-h-screen bg-bg-base relative overflow-x-hidden">
      <div className="ambient-halo" />
      <div className="relative z-[1] px-6 sm:px-10 py-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-7">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-accent-gold-dim flex items-center justify-center font-display font-bold text-bg-base text-sm">
            PM
          </div>
          <div className="flex items-center gap-3">
            {destinationOrg && (
              <a href={destinationOrg} className="text-[13px] text-accent-gold hover:underline">
                Basculer vers mon espace organisation
              </a>
            )}
            <form action={logout}>
              <button type="submit" className="text-[13px] text-text-muted hover:text-danger transition-colors">
                Déconnexion
              </button>
            </form>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
