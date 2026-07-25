import Link from 'next/link'
import { Store, Users2, Rocket, LineChart, BookOpen, FileText, MessageCircle, Target, Coins } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerBoussoleAutonomie, chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerProjetsAvecProgression, chargerFilActivite } from '@/lib/projetVie'
import { chargerFormationsAvecIcc, chargerCompetencesParDimension } from '@/lib/iccServer'
import { agregerScoresIcc } from '@/lib/icc'
import { chargerScoreMoyenQuiz, chargerSoldeCredits } from '@/lib/quizRevisionServer'
import { chargerMesCercles } from '@/lib/cerclesApprentissageServer'
import { chargerActiviteApprentissage, chargerActiviteTuteur, chargerActiviteSessionPro, chargerActiviteRevisions } from '@/lib/activiteRecente'
import { NIVEAU_LABEL } from '@/lib/iga'
import { PHRASE_SAVOIR_ETRE } from '@/lib/icc'
import { RadarAutonomie } from '../_components/RadarAutonomie'
import { AnneauProgression } from '../_components/AnneauProgression'
import { StatCard } from '../_components/StatCard'
import { MonParcours } from '../_components/MonParcours'

/** Organisation en 4 catégories (dashboard bénéficiaire v2, Lot A) : regroupement
 * additif des cartes déjà existantes, aucune supprimée ni déplacée hors d'atteinte —
 * seule la relecture par titre de section change. "Session professionnelle" est
 * l'intitulé affiché pour /insertion (module Insertion professionnelle existant,
 * pas un doublon — cf. PLAN_DASHBOARD_BENEFICIAIRE_V2.md, écart 1). */
const TUILES_MON_AVENIR = [
  { label: 'Session professionnelle', icon: Rocket, route: 'insertion' },
  { label: 'Intelligence économique', icon: LineChart, route: 'intelligence-economique' },
] as const

const TUILES_MES_SERVICES = [
  { label: 'Marketplace', icon: Store, route: 'marketplace' },
  { label: 'Cercles d’apprentissage', icon: Users2, route: 'cercles' },
] as const

export default async function MonEspaceDossierPage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [dossiers, boussole, projets, fil, formationsIcc, cercles, scoreMoyenQuiz, competences, solde, activiteTuteur, activiteSessionPro, activiteRevisions] =
    await Promise.all([
      chargerDossiersBeneficiaire(supabase),
      chargerBoussoleAutonomie(supabase, beneficiaireId),
      chargerProjetsAvecProgression(supabase, beneficiaireId),
      chargerFilActivite(supabase, beneficiaireId),
      chargerFormationsAvecIcc(supabase, beneficiaireId),
      chargerMesCercles(supabase, beneficiaireId),
      chargerScoreMoyenQuiz(supabase, beneficiaireId),
      chargerCompetencesParDimension(supabase, beneficiaireId),
      chargerSoldeCredits(supabase, beneficiaireId),
      chargerActiviteTuteur(supabase, beneficiaireId),
      chargerActiviteSessionPro(supabase, beneficiaireId),
      chargerActiviteRevisions(supabase, beneficiaireId),
    ])
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  if (!dossier) notFound()

  const activiteApprentissage = user ? await chargerActiviteApprentissage(supabase, user.id) : null

  const iccAgrege = agregerScoresIcc(formationsIcc.map((f) => f.score))
  const profilProfessionnelDisponible =
    boussole.scoreGlobal != null || iccAgrege.savoirs != null || iccAgrege.savoirFaire != null || iccAgrege.savoirEtre != null
  const nombreCompetencesValidees = [...competences.savoirs, ...competences.savoirFaire, ...competences.savoirEtre].filter((c) => c.statut === 'valide').length

  const projetsActifs = projets.filter((p) => p.statut !== 'abandonne')
  const projetPrincipal = projetsActifs.find((p) => p.statut === 'en_cours') ?? projetsActifs[0]
  const dernierEvenement = fil[0]

  const activitesRecentes = [
    activiteApprentissage && {
      cle: 'apprentissage',
      tag: 'Apprentissage',
      couleur: 'var(--accent-apprentissage)',
      titre: activiteApprentissage.formationTitre,
      sous: activiteApprentissage.chapitreTitre ?? undefined,
      pourcentage: activiteApprentissage.pourcentage,
      bouton: 'Continuer',
      href: `/mon-espace/${beneficiaireId}/marketplace`,
    },
    activiteTuteur && {
      cle: 'tuteur',
      tag: 'Tuteur IA',
      couleur: 'var(--accent-tuteur)',
      titre: 'Discussion en cours',
      sous: `${activiteTuteur.personaNom} — ${activiteTuteur.domaine}`,
      bouton: 'Poser une question',
      href: `/mon-espace/${beneficiaireId}/tuteurs/${activiteTuteur.sessionId}`,
    },
    activiteRevisions && {
      cle: 'revisions',
      tag: 'Révisions',
      couleur: 'var(--accent-revisions)',
      titre: activiteRevisions.documentNom,
      sous: activiteRevisions.meilleurScore != null ? `Dernier score : ${activiteRevisions.meilleurScore}%` : 'Aucune tentative pour l’instant',
      bouton: 'Continuer',
      href: `/mon-espace/${beneficiaireId}/revisions/quiz/${activiteRevisions.quizId}`,
    },
    activiteSessionPro && {
      cle: 'session_pro',
      tag: 'Session pro',
      couleur: 'var(--accent-pro)',
      titre: 'Simulation entretien',
      sous: activiteSessionPro.personaNom,
      bouton: 'Reprendre',
      href: `/mon-espace/${beneficiaireId}/tuteurs/${activiteSessionPro.sessionId}`,
    },
  ].filter(Boolean) as { cle: string; tag: string; couleur: string; titre: string; sous?: string; pourcentage?: number; bouton: string; href: string }[]

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Mon espace</p>
      <h1 className="font-cinzel font-semibold text-4xl text-text-primary">Bonjour {dossier.prenoms}</h1>
      <p className="text-text-muted text-sm mt-1.5 mb-9">{dossier.organisationNom}</p>

      {/* ============================== CARTES STATS ============================== */}
      <div id="boussole" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
        <StatCard
          label="IGA — Autonomie"
          valeur={boussole.scoreGlobal ?? '—'}
          suffixe={boussole.scoreGlobal != null ? '/100' : undefined}
          detail={boussole.scoreGlobal != null ? (NIVEAU_LABEL[boussole.niveau ?? ''] ?? boussole.niveau ?? '') : 'Aucune évaluation'}
          visuel={<AnneauProgression pourcentage={boussole.scoreGlobal ?? 0} taille={44} epaisseur={5} />}
          texteVocal={
            boussole.scoreGlobal != null
              ? `Ton indice général d'autonomie est de ${boussole.scoreGlobal} sur 100, niveau ${NIVEAU_LABEL[boussole.niveau ?? ''] ?? boussole.niveau}.`
              : "Aucune évaluation d'autonomie enregistrée pour l'instant."
          }
        />
        <StatCard
          label="Compétences (ICC)"
          valeur={nombreCompetencesValidees}
          detail="Compétences validées"
          lien={{ href: `${`/mon-espace/${beneficiaireId}`}#profil-professionnel`, texte: 'Voir mon profil →' }}
          visuel={<AnneauProgression pourcentage={iccAgrege.savoirs ?? iccAgrege.savoirFaire ?? iccAgrege.savoirEtre ?? 0} taille={44} epaisseur={5} />}
          texteVocal={`Tu as ${nombreCompetencesValidees} compétence${nombreCompetencesValidees > 1 ? 's' : ''} validée${nombreCompetencesValidees > 1 ? 's' : ''}.`}
        />
        <StatCard
          label="Crédits disponibles"
          valeur={solde}
          detail="Solde de crédits"
          lien={{ href: `/mon-espace/${beneficiaireId}/abonnement`, texte: 'Voir mon historique →' }}
          visuel={<Coins size={22} className="text-accent-gold" />}
          texteVocal={`Tu as ${solde} crédit${solde > 1 ? 's' : ''} disponible${solde > 1 ? 's' : ''}.`}
        />
        <StatCard
          label="Objectifs en cours"
          valeur={projetsActifs.length}
          detail="Projets actifs"
          lien={{ href: `/mon-espace/${beneficiaireId}/projets-vie`, texte: 'Continuer mes objectifs →' }}
          visuel={<Target size={22} className="text-accent-gold" />}
          texteVocal={`Tu as ${projetsActifs.length} objectif${projetsActifs.length > 1 ? 's' : ''} en cours.`}
        />
      </div>

      {/* ============================== REPRENDRE MON ACTIVITÉ ============================== */}
      {activitesRecentes.length > 0 && (
        <>
          <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mb-3.5">Reprendre mon activité</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
            {activitesRecentes.map((a) => (
              <Link
                key={a.cle}
                href={a.href}
                className="rounded-2xl p-4 border block hover:opacity-90 transition-opacity"
                style={{ background: `color-mix(in srgb, ${a.couleur} 14%, var(--bg-card))`, borderColor: `color-mix(in srgb, ${a.couleur} 30%, transparent)` }}
              >
                <span
                  className="font-data text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full inline-block mb-2.5"
                  style={{ background: `color-mix(in srgb, ${a.couleur} 22%, transparent)`, color: a.couleur }}
                >
                  {a.tag}
                </span>
                <p className="text-text-primary text-[13.5px] font-semibold leading-tight mb-1">{a.titre}</p>
                {a.sous && <p className="text-text-muted text-[11px] mb-2">{a.sous}</p>}
                {a.pourcentage != null && (
                  <div className="h-1 bg-bg-surface rounded-full overflow-hidden mb-2.5">
                    <div className="h-full rounded-full" style={{ width: `${a.pourcentage}%`, background: a.couleur }} />
                  </div>
                )}
                <span className="text-[11.5px] font-semibold" style={{ color: a.couleur }}>
                  {a.bouton} →
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ============================== MON PARCOURS ============================== */}
      <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mb-3.5">Mon parcours</p>
      <div className="mb-8">
        <MonParcours savoirs={competences.savoirs} savoirFaire={competences.savoirFaire} savoirEtre={competences.savoirEtre} />
      </div>

      {/* ============================== ME CONNAÎTRE (détail) ============================== */}
      <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mb-3.5">Me connaître — en détail</p>

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

      {/* Profil professionnel — synthèse ICC × IGA */}
      {profilProfessionnelDisponible && (
        <div id="profil-professionnel" className="bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6">
          <h2 className="font-cinzel text-[16px] text-text-primary mb-1">Profil professionnel</h2>
          <p className="text-text-muted text-[11.5px] mb-5">
            Une vue d’ensemble honnête de ta progression — pas un score à optimiser, un constat.
          </p>
          <div className="space-y-3.5">
            {[
              { label: 'Autonomie (IGA)', valeur: boussole.scoreGlobal },
              { label: 'Savoirs (ICC)', valeur: iccAgrege.savoirs },
              { label: 'Savoir-faire (ICC)', valeur: iccAgrege.savoirFaire },
              { label: 'Savoir-être (ICC)', valeur: iccAgrege.savoirEtre },
            ].map((ligne) => (
              <div key={ligne.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text-muted text-[12.5px]">{ligne.label}</span>
                  <span className="font-data text-accent-gold text-[12.5px]">{ligne.valeur ?? '—'}</span>
                </div>
                <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-gold to-accent-gold-dim rounded-full"
                    style={{ width: `${ligne.valeur ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {scoreMoyenQuiz != null && (
            <p className="text-text-muted text-[11.5px] mt-4 pt-4 border-t border-border-soft">
              Signal complémentaire : moyenne de tes quiz de révision — <span className="font-data text-accent-gold">{scoreMoyenQuiz}%</span>
            </p>
          )}
        </div>
      )}

      {/* ICC par formation */}
      {formationsIcc.map((f) => (
        <div key={f.formationId} className="bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6">
          <h2 className="font-cinzel text-[16px] text-text-primary mb-1">Indice de Compétences — {f.formationTitre}</h2>
          <p className="text-text-muted text-[11.5px] mb-4">Un bulletin de progression, pas un diplôme certifié.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-text-muted text-[11px] mb-1">Savoirs</p>
              <p className="font-data text-2xl text-accent-gold">{f.score.savoirs ?? '—'}</p>
              {f.competencesSavoir.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {f.competencesSavoir.map((c) => (
                    <li key={c.libelle} className="text-text-muted text-[11.5px] leading-snug">
                      Compétence validée : {c.libelle}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-text-muted text-[11px] mb-1">Savoir-faire</p>
              <p className="font-data text-2xl text-accent-gold">{f.score.savoirFaire ?? '—'}</p>
              {f.competencesSavoirFaire.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {f.competencesSavoirFaire.map((c) => (
                    <li key={c.libelle} className="text-text-muted text-[11.5px] leading-snug">
                      {c.libelle} — niveau {c.niveau}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-text-muted text-[11px] mb-1">Savoir-être</p>
              <p className="font-data text-2xl text-accent-gold">{f.score.savoirEtre ?? '—'}</p>
              {f.tagsSavoirEtre.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {f.tagsSavoirEtre.map((tag) => (
                    <li key={tag} className="text-text-muted text-[11.5px] leading-snug">
                      {PHRASE_SAVOIR_ETRE[tag as keyof typeof PHRASE_SAVOIR_ETRE] ?? tag}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Projet de vie / Objectifs */}
      <Link
        href={`/mon-espace/${beneficiaireId}/projets-vie`}
        className="block bg-bg-card border border-border-soft rounded-[10px] p-6 mb-10 hover:border-accent-gold-dim transition-colors"
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

      {/* ============================== APPRENDRE ============================== */}
      <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mb-3.5">Apprendre</p>

      <Link
        href={`/mon-espace/${beneficiaireId}/revisions`}
        className="block bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6 hover:border-accent-gold-dim transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen size={16} className="text-accent-gold" />
          <div>
            <h2 className="font-cinzel text-[16px] text-text-primary">Bibliothèque de révision</h2>
            <p className="text-text-muted text-[12.5px] mt-1">Dépose un support de formation et génère un quiz pour réviser.</p>
          </div>
        </div>
      </Link>

      <Link
        href={`/mon-espace/${beneficiaireId}/tuteurs`}
        className="block bg-bg-card border border-border-soft rounded-[10px] p-6 mb-10 hover:border-accent-gold-dim transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <MessageCircle size={16} className="text-accent-gold" />
          <div>
            <h2 className="font-cinzel text-[16px] text-text-primary">Espace Tuteurs</h2>
            <p className="text-text-muted text-[12.5px] mt-1">Dialogue avec un tuteur IA pour apprendre, ou entraîne-toi avec une simulation d’entretien.</p>
          </div>
        </div>
      </Link>

      {/* ============================== MON AVENIR ============================== */}
      <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mb-3.5">Mon avenir</p>

      <div className="grid grid-cols-2 gap-3.5 mb-6">
        {TUILES_MON_AVENIR.map((tuile) => {
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

      <Link
        href={`/mon-espace/${beneficiaireId}/cv`}
        className="block bg-bg-card border border-border-soft rounded-[10px] p-6 mb-10 hover:border-accent-gold-dim transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <FileText size={16} className="text-accent-gold" />
          <div>
            <h2 className="font-cinzel text-[16px] text-text-primary">Mon CV</h2>
            <p className="text-text-muted text-[12.5px] mt-1">Génère un CV à partir de ton profil de compétences et de ta progression.</p>
          </div>
        </div>
      </Link>

      {/* ============================== MES SERVICES ============================== */}
      <p className="font-data text-[11px] tracking-[0.18em] text-text-muted uppercase mb-3.5">Mes services</p>

      <div className="grid grid-cols-2 gap-3.5 mb-6">
        {TUILES_MES_SERVICES.map((tuile) => {
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

      <Link
        href={`/mon-espace/${beneficiaireId}/capital-social`}
        className="block bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6 hover:border-accent-gold-dim transition-colors"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-cinzel text-[16px] text-text-primary">Mon capital social</h2>
            <p className="text-text-muted text-[12.5px] mt-1">Les personnes et structures qui peuvent t’aider à avancer.</p>
          </div>
          <span className="font-data text-[11px] bg-sage-soft text-sage border border-sage/35 rounded-full px-3 py-1 whitespace-nowrap">Voir mon réseau →</span>
        </div>
      </Link>

      <Link
        href={`/mon-espace/${beneficiaireId}/abonnement`}
        className="block bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6 hover:border-accent-gold-dim transition-colors"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-cinzel text-[16px] text-text-primary">Mon abonnement</h2>
          <span className="text-accent-gold text-[12.5px]">Voir le statut →</span>
        </div>
      </Link>

      <Link
        href={`/mon-espace/${beneficiaireId}/parametres`}
        className="block bg-bg-card border border-border-soft rounded-[10px] p-6 hover:border-accent-gold-dim transition-colors"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-cinzel text-[16px] text-text-primary">Paramètres · Apparence</h2>
          <span className="text-accent-gold text-[12.5px]">Choisir ma palette →</span>
        </div>
      </Link>
    </div>
  )
}
