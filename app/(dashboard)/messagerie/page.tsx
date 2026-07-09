import { Inbox } from 'lucide-react'
import { PageHeader } from '../_components/ui'
import { MessagerieInbox } from '../../_components/messagerie/MessagerieInbox'

export default async function DashboardMessageriePage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const { conversation } = await searchParams

  return (
    <>
      <PageHeader eyebrowIcon={Inbox} eyebrowText="Cockpit Fondateur" title="Messagerie interne" subtitle="Échanges tracés avec les comptes Solo, Structure et Employeur." />
      <MessagerieInbox basePath="/messagerie" conversationIdSelectionnee={conversation} />
    </>
  )
}
