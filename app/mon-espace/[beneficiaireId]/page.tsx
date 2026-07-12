import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerBoussoleAutonomie, chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerProjetsAvecProgression, chargerFilActivite } from '@/lib/projetVie'
import { NIVEAU_LABEL } from '@/lib/iga'
import { RadarAutonomie } from '../_components/RadarAutonomie'

export default async function MonEspaceDossierPage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const [dossiers, boussole, projets, fil] = await Promise.all([
    chargerDossiersBeneficiaire(supabase),
    chargerBoussoleAutonomie(supabase, beneficiaireId),
    chargerProjetsAvecProgression(supabase, beneficiaireId),
    chargerFilActivite(supabase, beneficiaireId),
  ])
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  if (!dossier) notFound()

  const projetsActifs = projets.filter((p) => p.statut !== 'abandonne')
  const projetPrincipal = projetsActifs.find((p) => p.statut === 'en_cours') ?? projetsActifs[0]
  const dernierEvenement = fil[0]

  return (
    <div>
      <h1 className="font-display text-2xl text-text-primary mb-1">Bonjour {dossier.prenoms}</h1>
      <p className="text-text-muted text-sm mb-6">{dossier.organisationNom}</p>

      <div className="bg-bg-card border border-border-soft rounded-2xl p-6 mb-6">
        <h2 className="font-display font-medium text-[16.5px] text-text-primary mb-4">Boussole d'Autonomie</h2>
        {boussole.scoreGlobal == null ? (
          <p className="text-text-muted text-sm py-6 text-center">Aucune évaluation IGA enregistrée pour l'instant.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            <div className="text-center sm:text-left">
              <p className="font-data text-5xl text-accent-gold font-bold">{boussole.scoreGlobal}</p>
              <p className="text-text-muted text-sm mt-1">sur 100 — {NIVEAU_LABEL[boussole.niveau ?? ''] ?? boussole.niveau}</p>
              {boussole.referentielLabel && <p className="text-text-muted text-[11.5px] mt-3">{boussole.referentielLabel}</p>}
            </div>
            <RadarAutonomie dimensions={boussole.dimensions} />
          </div>
        )}
      </div>

      <Link
        href={`/mon-espace/${beneficiaireId}/projets-vie`}
        className="block bg-bg-card border border-border-soft rounded-2xl p-6 mb-6 hover:border-accent-gold-dim transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-medium text-[16.5px] text-text-primary">Projet de vie</h2>
          {projetsActifs.length > 1 && <span className="text-text-muted text-[11.5px]">+ {projetsActifs.length - 1} autre(s) projet(s) actif(s)</span>}
        </div>
        {!projetPrincipal ? (
          <p className="text-text-muted text-sm">Aucun projet de vie défini pour l'instant. Voir mes projets de vie →</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="text-text-primary text-[14px] font-medium">{projetPrincipal.titre}</span>
              {projetPrincipal.progression != null && <span className="font-data text-accent-gold text-[13px]">{projetPrincipal.progression}%</span>}
            </div>
            {projetPrincipal.progression != null && (
              <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden mb-3">
                <div className="h-full bg-gradient-to-r from-accent-gold to-accent-gold-dim rounded-full" style={{ width: `${projetPrincipal.progression}%` }} />
              </div>
            )}
            {dernierEvenement && <p className="text-text-muted text-[12.5px] mt-2">{dernierEvenement.message}</p>}
            <p className="text-accent-gold text-[12.5px] mt-3">Voir mes projets de vie →</p>
          </>
        )}
      </Link>
    </div>
  )
}
