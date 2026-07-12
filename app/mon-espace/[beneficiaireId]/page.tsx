import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerBoussoleAutonomie, chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerProjetsAvecProgression, chargerFilActivite } from '@/lib/projetVie'
import { chargerFormationsAvecIcc } from '@/lib/iccServer'
import { chargerMesCercles } from '@/lib/cerclesApprentissageServer'
import { NIVEAU_LABEL } from '@/lib/iga'
import { RadarAutonomie } from '../_components/RadarAutonomie'

export default async function MonEspaceDossierPage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const [dossiers, boussole, projets, fil, formationsIcc, cercles] = await Promise.all([
    chargerDossiersBeneficiaire(supabase),
    chargerBoussoleAutonomie(supabase, beneficiaireId),
    chargerProjetsAvecProgression(supabase, beneficiaireId),
    chargerFilActivite(supabase, beneficiaireId),
    chargerFormationsAvecIcc(supabase, beneficiaireId),
    chargerMesCercles(supabase, beneficiaireId),
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

      {formationsIcc.map((f) => (
        <div key={f.formationId} className="bg-bg-card border border-border-soft rounded-2xl p-6 mb-6">
          <h2 className="font-display font-medium text-[16.5px] text-text-primary mb-1">Indice de Compétences — {f.formationTitre}</h2>
          <p className="text-text-muted text-[11.5px] mb-4">Un bulletin de progression, pas un diplôme certifié.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-text-muted text-[11px] mb-1">Savoirs</p>
              <p className="font-data text-2xl text-accent-gold">{f.score.savoirs ?? '—'}</p>
            </div>
            <div>
              <p className="text-text-muted text-[11px] mb-1">Savoir-faire</p>
              <p className="font-data text-2xl text-accent-gold">{f.score.savoirFaire ?? '—'}</p>
            </div>
            <div>
              <p className="text-text-muted text-[11px] mb-1">Savoir-être</p>
              <p className="font-data text-2xl text-accent-gold">{f.score.savoirEtre ?? '—'}</p>
            </div>
          </div>
        </div>
      ))}

      {cercles.length > 0 && (
        <Link
          href={`/mon-espace/${beneficiaireId}/cercles`}
          className="block bg-bg-card border border-border-soft rounded-2xl p-6 hover:border-accent-gold-dim transition-colors"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display font-medium text-[16.5px] text-text-primary">Cercles d'apprentissage</h2>
            <span className="text-text-muted text-[11.5px]">{cercles.length} cercle(s)</span>
          </div>
          {cercles.some((c) => c.statut === 'invite') && <p className="text-accent-gold text-[12.5px] mt-2">Invitation(s) en attente →</p>}
        </Link>
      )}
    </div>
  )
}
