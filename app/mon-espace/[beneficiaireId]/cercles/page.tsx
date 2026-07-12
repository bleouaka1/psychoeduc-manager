import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerMesCercles } from '@/lib/cerclesApprentissageServer'
import { accepterInvitationCercleAction } from './actions'

const STATUT_LABEL: Record<string, string> = { invite: 'Invitation reçue', actif: 'Membre actif', sorti: 'Vous avez quitté ce cercle' }

export default async function MesCerclesPage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  if (!dossiers.find((d) => d.id === beneficiaireId)) notFound()

  const cercles = await chargerMesCercles(supabase, beneficiaireId)

  return (
    <div>
      <h1 className="font-display text-2xl text-text-primary mb-1">Mes cercles d'apprentissage</h1>
      <p className="text-text-muted text-sm mb-6">Groupes de discussion avec d'autres bénéficiaires, animés par un formateur.</p>

      {cercles.length === 0 ? (
        <div className="bg-bg-card border border-border-soft rounded-2xl p-10 text-center">
          <p className="text-text-muted text-sm">Aucun cercle pour l'instant.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {cercles.map((c) => (
            <li key={c.id} className="bg-bg-card border border-border-soft rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-text-primary font-medium">{c.nom}</span>
                <span className="text-[11.5px] text-text-muted">{STATUT_LABEL[c.statut] ?? c.statut}</span>
              </div>
              {c.description && <p className="text-text-muted text-[12.5px] mb-3">{c.description}</p>}
              {c.statut === 'invite' ? (
                <form action={accepterInvitationCercleAction.bind(null, beneficiaireId, c.id)}>
                  <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
                    Accepter l'invitation
                  </button>
                </form>
              ) : c.statut === 'actif' ? (
                <Link href={`/mon-espace/${beneficiaireId}/cercles/${c.id}`} className="text-accent-gold text-[12.5px]">
                  Ouvrir la discussion →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
