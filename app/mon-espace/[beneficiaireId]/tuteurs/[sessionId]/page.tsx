import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerSession, chargerMessagesTuteur } from '@/lib/tuteurIaServer'
import { envoyerMessageTuteur, terminerSessionTuteur } from '../actions'
import { ConversationTuteur } from './_components/ConversationTuteur'

export default async function SessionTuteurPage({ params }: { params: Promise<{ beneficiaireId: string; sessionId: string }> }) {
  const { beneficiaireId, sessionId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  if (!dossier) notFound()

  const [session, messages] = await Promise.all([chargerSession(supabase, sessionId), chargerMessagesTuteur(supabase, sessionId)])
  if (!session) notFound()

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">
        {session.objectif === 'entretien' ? 'Simulation d’entretien' : 'Espace Tuteurs'}
      </p>
      <h1 className="font-cinzel font-semibold text-2xl text-text-primary mb-1">{session.personaNom}</h1>
      <p className="text-text-muted text-sm mb-7">{session.personaDomaine}</p>

      <ConversationTuteur
        beneficiaireId={beneficiaireId}
        sessionId={sessionId}
        messagesInitiaux={messages}
        sessionActive={session.statut === 'active'}
        envoyer={envoyerMessageTuteur.bind(null, beneficiaireId, sessionId)}
        terminer={terminerSessionTuteur.bind(null, beneficiaireId, sessionId)}
      />
    </div>
  )
}
