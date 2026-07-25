import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerAbonnementBaseActif } from '@/lib/abonnementBase'
import { chargerSoldeCredits } from '@/lib/quizRevisionServer'
import { demarrerAbonnementBase } from './actions'
import { SouscrireFormule } from './_components/SouscrireFormule'

const STATUT_LABEL: Record<string, string> = {
  actif: 'Actif',
  expire: 'Expiré',
  aucun: 'Aucun abonnement',
}

const FORMULES = [
  { id: 'base' as const, nom: 'Abonnement de base', prix: '200 FCFA/mois', description: 'Moteur de quiz sans IA, glossaire, lecture accompagnée, flashcards de base.' },
  { id: 'pack_2_matieres' as const, nom: 'Pack « 2 matières/jour »', prix: '2500 FCFA/mois', description: 'Espace Tuteurs plafonné à 2 matières/jour — offrable par un parent ou une structure.' },
  { id: 'tout_inclus' as const, nom: 'Tout-inclus', prix: '6000 FCFA/mois', description: 'Accès étendu à toutes les fonctionnalités IA.' },
]

export default async function AbonnementPage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  if (!dossier) notFound()

  const [abonnement, solde] = await Promise.all([chargerAbonnementBaseActif(supabase, beneficiaireId), chargerSoldeCredits(supabase, beneficiaireId)])
  const formatterDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const demarrer = demarrerAbonnementBase.bind(null, beneficiaireId)

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Mon espace</p>
      <h1 className="font-cinzel font-semibold text-3xl text-text-primary mb-1">Mon abonnement</h1>
      <p className="text-text-muted text-sm mb-7">
        Le filet de sécurité de base reste toujours accessible à très bas coût — ta structure ou un parent peuvent le prendre en charge si tu ne peux pas payer toi-même.
      </p>

      <div className="bg-bg-card border border-border-soft rounded-[10px] p-6 mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-primary text-[14px] font-medium">{abonnement.typeFormule ? FORMULES.find((f) => f.id === abonnement.typeFormule)?.nom ?? abonnement.typeFormule : 'Statut actuel'}</span>
          <span className="text-[11px] bg-bg-surface border border-border-soft text-text-muted px-2 py-0.5 rounded-full">{STATUT_LABEL[abonnement.statut]}</span>
        </div>
        {abonnement.periodeFin && <p className="text-text-muted text-[12.5px]">Jusqu’au {formatterDate.format(new Date(abonnement.periodeFin))}</p>}
        <p className="text-text-muted text-[12.5px] mt-2">
          Solde de crédits (fonctionnalités IA à l’usage) : <span className="font-data text-accent-gold">{solde}</span>
        </p>
      </div>

      <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mb-3.5">Formules disponibles</p>
      <div className="space-y-3.5">
        {FORMULES.map((formule) => (
          <div key={formule.id} className="bg-bg-card border border-border-soft rounded-[10px] p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="text-text-primary text-[14px] font-medium">{formule.nom}</span>
                <span className="font-data text-accent-gold text-[12.5px]">{formule.prix}</span>
              </div>
              <p className="text-text-muted text-[12px]">{formule.description}</p>
            </div>
            <SouscrireFormule typeFormule={formule.id} demarrer={demarrer} />
          </div>
        ))}
      </div>
    </div>
  )
}
