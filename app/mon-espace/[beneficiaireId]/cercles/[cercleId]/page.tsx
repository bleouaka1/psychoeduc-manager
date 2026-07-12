import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { envoyerMessageCercleBeneficiaireAction, signalerCercleAction, quitterCercleAction } from '../actions'

export default async function CercleBeneficiairePage({ params }: { params: Promise<{ beneficiaireId: string; cercleId: string }> }) {
  const { beneficiaireId, cercleId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  if (!dossiers.find((d) => d.id === beneficiaireId)) notFound()

  const { data: appartenance } = await supabase.from('cercles_membres').select('statut').eq('cercle_id', cercleId).eq('beneficiaire_id', beneficiaireId).maybeSingle()
  if (!appartenance || appartenance.statut !== 'actif') notFound()

  const { data: cercle } = await supabase.from('cercles_apprentissage').select('id, nom, charte, description, conversation_id, organisation_id').eq('id', cercleId).single()
  if (!cercle) notFound()

  const { data: messages } = cercle.conversation_id
    ? await supabase.from('messages').select('id, contenu, expediteur_id, created_at, profiles!expediteur_id(nom, prenoms)').eq('conversation_id', cercle.conversation_id).order('created_at', { ascending: true })
    : { data: [] as any[] }

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-text-primary">{cercle.nom}</h1>
        <Link href={`/mon-espace/${beneficiaireId}/cercles`} className="text-text-muted hover:text-text-primary text-[13px]">
          ← Mes cercles
        </Link>
      </div>
      {cercle.description && <p className="text-text-muted text-sm mb-4">{cercle.description}</p>}

      {cercle.charte && (
        <div className="bg-bg-card border border-border-soft rounded-2xl p-5 mb-6">
          <h2 className="font-display font-medium text-[14px] text-text-primary mb-2">Charte du cercle</h2>
          <p className="text-text-muted text-[13px] whitespace-pre-line">{cercle.charte}</p>
        </div>
      )}

      <div className="bg-bg-card border border-border-soft rounded-2xl p-6 mb-6">
        <h2 className="font-display font-medium text-[16.5px] text-text-primary mb-4">Discussion</h2>
        <ul className="space-y-2.5 mb-4 max-h-96 overflow-y-auto">
          {(messages ?? []).length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">Aucun message pour l'instant.</p>
          ) : (
            (messages ?? []).map((m: any) => (
              <li key={m.id} className="bg-bg-surface border border-border-soft rounded-xl px-3.5 py-2.5">
                <p className="text-text-muted text-[11px] mb-0.5">
                  {m.profiles?.prenoms ?? ''} {m.profiles?.nom ?? ''} — {formatter.format(new Date(m.created_at))}
                </p>
                <p className="text-text-primary text-[13px]">{m.contenu}</p>
              </li>
            ))
          )}
        </ul>
        {cercle.conversation_id && (
          <form action={envoyerMessageCercleBeneficiaireAction.bind(null, beneficiaireId, cercleId, cercle.conversation_id, cercle.organisation_id)} className="flex gap-2.5">
            <input name="contenu" required placeholder="Écrire au cercle…" className="flex-1 bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim" />
            <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
              Envoyer
            </button>
          </form>
        )}
      </div>

      <div className="flex gap-2.5">
        <form action={signalerCercleAction.bind(null, beneficiaireId, cercleId)}>
          <button type="submit" className="text-[12.5px] text-text-muted hover:text-status-warn border border-border-soft rounded-full px-3.5 py-2">
            Signaler
          </button>
        </form>
        <form action={quitterCercleAction.bind(null, beneficiaireId, cercleId)}>
          <button type="submit" className="text-[12.5px] text-text-muted hover:text-danger border border-border-soft rounded-full px-3.5 py-2">
            Quitter ce cercle
          </button>
        </form>
      </div>
    </div>
  )
}
