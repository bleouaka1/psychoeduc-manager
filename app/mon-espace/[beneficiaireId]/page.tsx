import Link from 'next/link'
import { Store, Users2, Rocket, LineChart } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerBoussoleAutonomie, chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerProjetsAvecProgression, chargerFilActivite } from '@/lib/projetVie'
import { chargerFormationsAvecIcc } from '@/lib/iccServer'
import { chargerMesCercles } from '@/lib/cerclesApprentissageServer'
import { NIVEAU_LABEL } from '@/lib/iga'
import { RadarAutonomie } from '../_components/RadarAutonomie'

const TUILES_EXPLORER = [
  { label: 'Marketplace', icon: Store, route: 'marketplace' },
  { label: 'Cercles d’apprentissage', icon: Users2, route: 'cercles' },
  { label: 'Insertion professionnelle', icon: Rocket, route: 'insertion' },
  { label: 'Intelligence économique', icon: LineChart, route: 'intelligence-economique' },
] as const

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
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Mon espace</p>
      <h1 className="font-cinzel font-semibold text-4xl text-text-primary">Bonjour {dossier.prenoms}</h1>
      <p className="text-text-muted text-sm mt-1.5 mb-9">{dossier.organisationNom}</p>

      {/* Boussole d'Autonomie */}
      <div className="bg-bg-card border border-border-soft rounded-[10px] p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-gold to-transparent" />
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-6">
          <h2 className="font-cinzel text-[19px] tracking-wide uppercase text-text-primary">Boussole d’Autonomie</h2>
          <span className="font-data text-[10.5px] tracking-wide text-text-muted uppercase">Indice Général d’Autonomie</span>
        </div>

        {boussole.scoreGlobal == null ? (
          <div className="flex items-center gap-10 flex-wrap justify-center">
            <RadarAutonomie dimensions={[]} />
            <div className="flex-1 min-w-[240px]">
              <p className="text-text-muted text-[14.5px] leading-relaxed mb-4">
                Aucune évaluation IGA enregistrée pour l’instant. L’IGA mesure ta progression sur plusieurs dimensions de vie et donne un point de départ clair pour ton parcours.
              </p>
              <p className="text-text-muted text-[13px]">
                Ton formateur ou éducateur référent peut réaliser cette évaluation avec toi lors d’un prochain échange.
              </p>
            </div>
          </div>
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

      {/* Projet de vie */}
      <Link
        href={`/mon-espace/${beneficiaireId}/projets-vie`}
        className="block bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6 hover:border-accent-gold-dim transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-cinzel text-[16px] text-text-primary">Projet de vie</h2>
          {projetsActifs.length > 1 && <span className="text-text-muted text-[11.5px]">+ {projetsActifs.length - 1} autre(s) projet(s) actif(s)</span>}
        </div>
        {!projetPrincipal ? (
          <p className="text-text-muted text-sm">Aucun projet de vie défini pour l’instant. Voir mes projets de vie →</p>
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

      {/* Explorer */}
      <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mt-10 mb-3.5">Explorer</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
        {TUILES_EXPLORER.map((tuile) => {
          const Icon = tuile.icon
          return (
            <Link
              key={tuile.label}
              href={`/mon-espace/${beneficiaireId}/${tuile.route}`}
              className="bg-bg-card border border-border-soft rounded-[8px] p-5 text-center hover:border-accent-gold-dim transition-colors"
            >
              <div className="w-9 h-9 mx-auto mb-3 rounded-lg bg-accent-gold/10 flex items-center justify-center text-accent-gold">
                <Icon size={16} />
              </div>
              <p className="font-cinzel text-[12.5px] text-text-primary leading-tight">{tuile.label}</p>
            </Link>
          )
        })}
      </div>

      {/* ICC */}
      {formationsIcc.map((f) => (
        <div key={f.formationId} className="bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6">
          <h2 className="font-cinzel text-[16px] text-text-primary mb-1">Indice de Compétences — {f.formationTitre}</h2>
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

      <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mt-10 mb-3.5">Tes espaces</p>

      {/* Cercles d'apprentissage */}
      {cercles.length > 0 && (
        <Link
          href={`/mon-espace/${beneficiaireId}/cercles`}
          className="block bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6 hover:border-accent-gold-dim transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-cinzel text-[16px] text-text-primary mb-1">Cercles d’apprentissage</h2>
              <p className="text-text-muted text-[12.5px]">{cercles.length} cercle(s) actif(s) auxquels tu peux participer.</p>
            </div>
            <span className="font-data text-[11px] bg-accent-gold/10 text-accent-gold border border-accent-gold-dim/40 rounded-full px-3 py-1 whitespace-nowrap">
              {cercles.length} cercle(s)
            </span>
          </div>
          {cercles.some((c) => c.statut === 'invite') && <p className="text-accent-gold text-[12.5px] mt-2">Invitation(s) en attente →</p>}
        </Link>
      )}

      {/* Capital social */}
      <Link
        href={`/mon-espace/${beneficiaireId}/capital-social`}
        className="block bg-bg-card border border-border-soft rounded-[10px] p-6 hover:border-accent-gold-dim transition-colors"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-cinzel text-[16px] text-text-primary">Mon capital social</h2>
            <p className="text-text-muted text-[12.5px] mt-1">Les personnes et structures qui peuvent t’aider à avancer.</p>
          </div>
          <span className="font-data text-[11px] bg-sage-soft text-sage border border-sage/35 rounded-full px-3 py-1 whitespace-nowrap">Voir mon réseau →</span>
        </div>
      </Link>
    </div>
  )
}
