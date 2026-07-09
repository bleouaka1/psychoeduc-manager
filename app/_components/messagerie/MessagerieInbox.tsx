import Link from 'next/link'
import { Inbox, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Panel } from '../../(dashboard)/_components/ui'
import { DemandeCard } from './DemandeCard'
import { ComposeBar } from './ComposeBar'
import { envoyerMessageInterneAction, demanderPieceAction, envoyerPieceJointeAction } from '../../messagerie/actions'

export async function MessagerieInbox({ basePath, conversationIdSelectionnee }: { basePath: string; conversationIdSelectionnee?: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: estFondateur } = await supabase.rpc('is_fondateur')

  const { data: mesParticipations } = await supabase.from('conversation_participants').select('conversation_id').eq('profile_id', user.id)
  const idsParticipations = (mesParticipations ?? []).map((p: any) => p.conversation_id)

  let requeteConversations = supabase
    .from('conversations')
    .select('id, titre, organisation_id, beneficiaire_id, updated_at, beneficiaires(nom, prenoms), conversation_participants(profile_id, role_participant, profiles(nom, prenoms))')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (!estFondateur) requeteConversations = requeteConversations.in('id', idsParticipations.length > 0 ? idsParticipations : ['00000000-0000-0000-0000-000000000000'])

  const { data: conversations } = await requeteConversations

  const conversationActive = conversationIdSelectionnee ? (conversations ?? []).find((c: any) => c.id === conversationIdSelectionnee) : null

  const { data: messages } = conversationActive
    ? await supabase
        .from('messages')
        .select('id, expediteur_id, contenu, type_message, type_document, statut_demande, created_at')
        .eq('conversation_id', conversationActive.id)
        .order('created_at', { ascending: true })
    : { data: null }

  const messageIds = (messages ?? []).map((m: any) => m.id)
  const { data: piecesJointesReelles } = messageIds.length > 0 ? await supabase.from('pieces_jointes').select('id, message_id, fichier_path, nom_original').in('message_id', messageIds) : { data: [] as any[] }

  const cheminsAvecUrl = new Map<string, string>()
  if (piecesJointesReelles && piecesJointesReelles.length > 0) {
    const { data: signees } = await supabase.storage.from('messagerie-pieces-jointes').createSignedUrls(
      piecesJointesReelles.map((p: any) => p.fichier_path),
      300,
    )
    ;(signees ?? []).forEach((s: any, i: number) => {
      if (s.signedUrl) cheminsAvecUrl.set(piecesJointesReelles[i].fichier_path, s.signedUrl)
    })
  }

  const peutDemanderPiece =
    Boolean(estFondateur) && Boolean(conversationActive?.conversation_participants?.some((p: any) => p.profile_id === user.id))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 h-[calc(100vh-220px)] min-h-[500px]">
      <Panel className="!p-0 overflow-hidden flex flex-col">
        <div className="px-4 py-3.5 border-b border-border-soft flex items-center gap-2">
          <Inbox size={15} className="text-accent-gold" />
          <p className="font-display text-[15px] text-text-primary">Conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll">
          {(conversations ?? []).length === 0 ? (
            <p className="text-text-muted text-[12.5px] p-4 text-center">Aucune conversation pour le moment.</p>
          ) : (
            (conversations ?? []).map((c: any) => {
              const autreParticipant = (c.conversation_participants ?? []).find((p: any) => p.profile_id !== user.id)
              const nomAutre = autreParticipant?.profiles ? `${autreParticipant.profiles.prenoms ?? ''} ${autreParticipant.profiles.nom ?? ''}`.trim() : 'Conversation'
              const actif = c.id === conversationIdSelectionnee
              return (
                <Link
                  key={c.id}
                  href={`${basePath}?conversation=${c.id}`}
                  className={`flex items-center gap-2.5 px-4 py-3 border-b border-border-soft/60 last:border-0 ${actif ? 'bg-bg-surface' : 'hover:bg-bg-surface/60'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-teal to-accent-teal-dim flex items-center justify-center text-[11px] font-semibold text-bg-base shrink-0">
                    {nomAutre.slice(0, 1).toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-text-primary text-[13px] font-medium truncate">{c.titre || nomAutre}</p>
                    {c.beneficiaires && (
                      <p className="text-text-muted text-[11px] truncate">
                        {c.beneficiaires.prenoms} {c.beneficiaires.nom}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </Panel>

      <Panel className="!p-0 overflow-hidden flex flex-col">
        {!conversationActive ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-muted text-[13px] flex items-center gap-2">
              <MessageSquare size={15} /> Sélectionnez une conversation
            </p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3.5 border-b border-border-soft">
              <p className="font-display text-[15px] text-text-primary">{(conversationActive as any).titre || 'Conversation'}</p>
              {(conversationActive as any).beneficiaires && (
                <p className="text-text-muted text-[11.5px]">
                  Dossier : {(conversationActive as any).beneficiaires.prenoms} {(conversationActive as any).beneficiaires.nom}
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto thin-scroll px-4 py-4 space-y-3">
              {(messages ?? []).map((m: any) => {
                const piecesDuMessage = (piecesJointesReelles ?? []).filter((p: any) => p.message_id === m.id)
                const estMoi = m.expediteur_id === user.id
                if (m.type_message === 'demande_piece') {
                  return (
                    <div key={m.id} className={estMoi ? 'ml-auto' : ''}>
                      <DemandeCard typeDocument={m.type_document} note={m.contenu} statutDemande={m.statut_demande} />
                    </div>
                  )
                }
                return (
                  <div
                    key={m.id}
                    className={`rounded-xl px-3.5 py-2.5 text-[13px] max-w-[85%] ${estMoi ? 'bg-accent-gold/10 border border-accent-gold-dim/40 ml-auto' : 'bg-bg-surface border border-border-soft'}`}
                  >
                    <p className="text-text-primary whitespace-pre-wrap">{m.contenu}</p>
                    {piecesDuMessage.map((p: any) => (
                      <a key={p.id} href={cheminsAvecUrl.get(p.fichier_path)} target="_blank" rel="noreferrer" className="text-accent-gold text-[12px] underline block mt-1">
                        📎 {p.nom_original}
                      </a>
                    ))}
                    <p className="text-text-muted text-[10.5px] mt-1">{new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(m.created_at))}</p>
                  </div>
                )
              })}
            </div>
            <div className="px-4 pb-4">
              <ComposeBar
                peutDemanderPiece={peutDemanderPiece}
                envoyerMessage={envoyerMessageInterneAction.bind(null, conversationActive.id, conversationActive.organisation_id)}
                envoyerPieceJointe={envoyerPieceJointeAction.bind(null, conversationActive.id, conversationActive.organisation_id)}
                demanderPiece={demanderPieceAction.bind(null, conversationActive.id, conversationActive.organisation_id)}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
