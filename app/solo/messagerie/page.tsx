import { Inbox } from 'lucide-react'
import { PageHeader } from '../../(dashboard)/_components/ui'
import { MessagerieInbox } from '../../_components/messagerie/MessagerieInbox'

export default async function SoloMessageriePage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const { conversation } = await searchParams

  return (
    <>
      <PageHeader eyebrowIcon={Inbox} eyebrowText="Mon espace Solo" title="Messagerie interne" subtitle="Échanges tracés avec le Fondateur et les autres praticiens liés à un même dossier." />
      <MessagerieInbox basePath="/solo/messagerie" conversationIdSelectionnee={conversation} />
    </>
  )
}
