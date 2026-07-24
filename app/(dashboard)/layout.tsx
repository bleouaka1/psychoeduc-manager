import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Sidebar from './_components/Sidebar'
import Topbar from './_components/Topbar'
import { getMonOrganisation } from './_lib/getMonOrganisation'

export const metadata: Metadata = {
  title: 'Cockpit Fondateur — PsychoÉduc Manager',
  description: 'Cockpit Fondateur — PsychoÉduc Manager',
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // §4.1/§5 : les sous-menus du module Gestion Administrative ne doivent apparaître nulle
  // part dans l'interface tant que l'organisation ne l'a pas activé — Fondateur voit tout
  // (superviseur plateforme, pas soumis au réglage d'une organisation en particulier).
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  const organisation = estFondateur ? null : await getMonOrganisation()
  let moduleAdminActif = Boolean(estFondateur)
  if (organisation) {
    const { data } = await supabase.from('organisations').select('module_admin_actif').eq('id', organisation.id).single()
    moduleAdminActif = data?.module_admin_actif ?? false
  }

  return (
    <div className="cockpit-fondateur flex min-h-screen bg-bg-base overflow-x-hidden">
      <div className="ambient-halo" />
      <div className="ambient-halo-warm" />
      <Sidebar email={user?.email} moduleAdminActif={moduleAdminActif} />
      <div className="flex-1 flex flex-col min-w-0 relative z-[1]">
        <Topbar email={user?.email} />
        <main className="flex-1 px-10 pb-16">{children}</main>
      </div>
    </div>
  )
}
