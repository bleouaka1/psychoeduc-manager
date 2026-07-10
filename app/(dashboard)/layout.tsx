import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Sidebar from './_components/Sidebar'
import Topbar from './_components/Topbar'

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

  return (
    <div className="cockpit-fondateur flex min-h-screen bg-bg-base overflow-x-hidden">
      <div className="ambient-halo" />
      <div className="ambient-halo-warm" />
      <Sidebar email={user?.email} />
      <div className="flex-1 flex flex-col min-w-0 relative z-[1]">
        <Topbar email={user?.email} />
        <main className="flex-1 px-10 pb-16">{children}</main>
      </div>
    </div>
  )
}
