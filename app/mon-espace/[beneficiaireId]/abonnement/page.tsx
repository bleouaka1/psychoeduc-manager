import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerAbonnementActif } from '@/lib/abonnementBeneficiaire'

const STATUT_LABEL: Record<string, string> = {
  actif: 'Actif',
  expire: 'Expiré',
  suspendu: 'Suspendu',
}

export default async function AbonnementPage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  if (!dossier) notFound()

  const abonnement = await chargerAbonnementActif(supabase, beneficiaireId)
  const formatterDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Mon espace</p>
      <h1 className="font-cinzel font-semibold text-3xl text-text-primary mb-1">Mon abonnement</h1>
      <p className="text-text-muted text-sm mb-7">Le statut réel de ton abonnement, tel qu’enregistré par ta structure.</p>

      <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
        {!abonnement ? (
          <p className="text-text-muted text-sm">Aucun abonnement enregistré pour l’instant.</p>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-text-primary text-[14px] font-medium">{abonnement.formule}</span>
              <span className="text-[11px] bg-bg-surface border border-border-soft text-text-muted px-2 py-0.5 rounded-full">{STATUT_LABEL[abonnement.statut]}</span>
            </div>
            <p className="text-text-muted text-[12.5px]">Depuis le {formatterDate.format(new Date(abonnement.dateDebut))}</p>
            {abonnement.dateFin && <p className="text-text-muted text-[12.5px]">Jusqu’au {formatterDate.format(new Date(abonnement.dateFin))}</p>}
            <p className="text-text-muted text-[12.5px]">Renouvellement automatique : {abonnement.renouvellementAuto ? 'oui' : 'non'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
