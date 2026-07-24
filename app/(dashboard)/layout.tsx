import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Sidebar from './_components/Sidebar'
import Topbar from './_components/Topbar'
import { getMonOrganisation } from './_lib/getMonOrganisation'
import { organisationApercuActive } from '@/lib/apercu'
import { ApercuBanner } from './_components/ApercuBanner'

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

  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  const apercu = estFondateur ? await organisationApercuActive() : null

  // getMonOrganisation() n'est appelée pour un Fondateur QUE si l'aperçu est actif — sinon
  // un Fondateur incidemment membre d'une organisation (ex. propre compte de test créé via
  // self-signup) verrait le module Gestion Administrative de CETTE organisation plutôt que
  // toujours activé, cassant le comportement d'origine "Fondateur voit tout, sans réglage".
  let moduleAdminActif = Boolean(estFondateur)
  if (!estFondateur || apercu) {
    const organisation = await getMonOrganisation()
    if (organisation) {
      const { data } = await supabase.from('organisations').select('module_admin_actif').eq('id', organisation.id).single()
      moduleAdminActif = data?.module_admin_actif ?? false
    }
  }

  return (
    <div className="cockpit-fondateur flex min-h-screen bg-bg-base overflow-x-hidden">
      <div className="ambient-halo" />
      <div className="ambient-halo-warm" />
      <Sidebar email={user?.email} moduleAdminActif={moduleAdminActif} estFondateur={Boolean(estFondateur)} />
      <div className="flex-1 flex flex-col min-w-0 relative z-[1]">
        <Topbar email={user?.email} />
        <main className="flex-1 px-10 pb-16">
          {apercu && <ApercuBanner organisation={apercu} />}
          {children}
        </main>
      </div>
    </div>
  )
}
