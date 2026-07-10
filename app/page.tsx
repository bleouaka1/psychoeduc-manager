import Link from 'next/link'
import './landing.css'
import { LandingReveal } from './_components/LandingReveal'

const DIMENSIONS_BOUSSOLE = [
  { label: 'LOGEMENT', x: 200, y: 16, anchor: 'middle' as const },
  { label: 'EMPLOI', x: 345, y: 70, anchor: 'start' as const },
  { label: 'SANTÉ', x: 392, y: 204, anchor: 'start' as const },
  { label: 'FAMILLE', x: 345, y: 336, anchor: 'start' as const },
  { label: 'FINANCES', x: 200, y: 396, anchor: 'middle' as const },
  { label: 'LANGUE', x: 55, y: 336, anchor: 'end' as const },
  { label: 'CITOYENNETÉ', x: 8, y: 204, anchor: 'end' as const },
  { label: 'RÉSEAU', x: 55, y: 70, anchor: 'end' as const },
]

const MODULES = [
  {
    num: '01 — PILOTAGE',
    titre: 'Cockpit Fondateur',
    texte: "Tableau de bord unique avec la Boussole d'Autonomie : une lecture immédiate de la progression sur les 8 dimensions de l'IGA.",
    objectif: "donner une vision d'ensemble instantanée, pour prioriser les actions plutôt que de naviguer entre les dossiers.",
  },
  {
    num: '02 — ENTRETIENS',
    titre: "Fiches d'entretien modulaires",
    texte: 'Fiche générale en blocs Constat / Besoin / Action, et fiche spécialisée avec observation comportementale et verbatims — le tout alimentant une chronologie unique.',
    objectif: "structurer chaque entretien sans figer la pratique, pour que l'écrit serve l'accompagnement au lieu de l'alourdir.",
  },
  {
    num: '03 — SUIVI',
    titre: 'Chronologie du bénéficiaire',
    texte: 'Chaque interaction, chaque décision, chaque signalement s\'inscrit dans une frise chronologique lisible et exportable.',
    objectif: 'garantir la continuité du suivi, même en cas de changement de praticien ou de relais entre structures.',
  },
  {
    num: '04 — LIAISON',
    titre: 'Messagerie directe',
    texte: 'Contact WhatsApp et e-mail intégré vers les bénéficiaires, familles ou formateurs, avec traçabilité complète des échanges.',
    objectif: "fluidifier la relation au quotidien sans sortir de l'outil, tout en conservant une preuve des échanges.",
  },
  {
    num: '05 — RESSOURCES',
    titre: 'Marketplace de formations',
    texte: 'Un catalogue multi-fournisseurs de formations et services, modéré et validé, directement rattachable au projet du bénéficiaire.',
    objectif: 'connecter chaque besoin identifié à une ressource concrète, sans recherche externe fastidieuse.',
  },
  {
    num: '06 — RESTITUTION',
    titre: 'Rapports co-brandés',
    texte: 'Des exports PDF professionnels, automatiquement mis aux couleurs de votre structure — prêts à être transmis à vos partenaires.',
    objectif: 'valoriser le travail réalisé auprès des financeurs et partenaires, sans mise en forme manuelle.',
  },
]

const ETAPES = [
  { idx: '01', titre: 'Accueil & diagnostic', texte: "Recueil de situation et premier positionnement sur l'IGA." },
  { idx: '02', titre: 'Élaboration du projet', texte: 'Définition des objectifs avec le bénéficiaire.' },
  { idx: '03', titre: 'Mobilisation des ressources', texte: 'Orientation vers formations, aides et partenaires.' },
  { idx: '04', titre: 'Mise en œuvre', texte: 'Suivi actif des actions engagées, entretien après entretien.' },
  { idx: '05', titre: 'Consolidation', texte: 'Vérification de la stabilité des acquis dans la durée.' },
  { idx: '06', titre: 'Autonomie & sortie', texte: 'Bilan final et accompagnement de la transition.' },
]

const AUDIENCES = [
  {
    tag: 'SOLO',
    titre: 'Praticien indépendant',
    texte: 'Pour les éducateurs, psychologues et travailleurs sociaux qui exercent seuls et veulent professionnaliser leur suivi sans lourdeur administrative.',
    items: ['Messagerie directe simplifiée', "Fiches d'entretien prêtes à l'emploi", 'Rapports PDF personnels'],
    type: 'solo',
  },
  {
    tag: 'STRUCTURE',
    titre: 'Écoles, associations, cabinets',
    texte: 'Pour les équipes qui coordonnent plusieurs accompagnants autour des mêmes bénéficiaires, avec une gouvernance et une identité communes.',
    items: ['Co-branding sur tous les exports', 'Gestion multi-praticiens', 'Modération de la marketplace'],
    type: 'structure',
  },
  {
    tag: 'EMPLOYEUR',
    titre: "Partenaires d'insertion",
    texte: "Pour les employeurs engagés dans des parcours d'insertion, avec une lecture claire de la progression avant et pendant l'embauche.",
    items: ["Suivi des jalons d'insertion", 'Rapports de progression partagés', 'Traçabilité des échanges'],
    type: 'employeur',
  },
]

const CONTACT_EMAIL = 'contact@psychoeduc-manager.com'

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header>
        <nav>
          <div className="brand">
            <BoussoleLogo />
            <span className="brand-name">PsychoÉduc&nbsp;Manager</span>
          </div>
          <div className="nav-links">
            <a href="#vision">Vision</a>
            <a href="#chemins">Commencer</a>
            <a href="#plateforme">Plateforme</a>
            <a href="#parcours">Parcours</a>
            <a href="#pour-qui">Pour qui</a>
            <a href="#confiance">Confiance</a>
          </div>
          <div className="nav-auth">
            <a href="#contact" className="nav-login nav-login-hide-md">Demander une démo</a>
            <Link href="/login" className="nav-login nav-login-hide-sm">Connexion</Link>
            <Link href="/inscription" className="nav-cta">Créer un compte</Link>
          </div>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-inner">
          <span className="eyebrow">Logiciel de suivi socio-éducatif</span>
          <h1>
            Chaque parcours d&apos;autonomie mérite d&apos;être vu <em>dans son entier.</em>
          </h1>
          <p className="lede">
            PsychoÉduc Manager accompagne les professionnels qui accompagnent les personnes — praticiens indépendants,
            structures et employeurs — avec un outil pensé pour la rigueur, la continuité et le respect dû aux publics
            accompagnés.
          </p>
          <div className="hero-ctas">
            <Link href="/inscription" className="btn-primary">Créer un compte</Link>
            <a href="#plateforme" className="btn-ghost">Découvrir la plateforme</a>
          </div>

          <div className="compass-stage">
            <div className="compass-glow" />
            <svg className="compass-svg" viewBox="0 0 400 400">
              <circle cx="200" cy="200" r="178" fill="none" stroke="rgba(236,230,216,0.08)" strokeWidth="1" />
              <circle cx="200" cy="200" r="140" fill="none" stroke="rgba(236,230,216,0.06)" strokeWidth="1" />
              <g stroke="#5c6c82" strokeWidth="1">
                <line x1="200" y1="22" x2="200" y2="36" />
                <line x1="326" y1="74" x2="316" y2="84" />
                <line x1="378" y1="200" x2="364" y2="200" />
                <line x1="326" y1="326" x2="316" y2="316" />
                <line x1="200" y1="378" x2="200" y2="364" />
                <line x1="74" y1="326" x2="84" y2="316" />
                <line x1="22" y1="200" x2="36" y2="200" />
                <line x1="74" y1="74" x2="84" y2="84" />
              </g>
              {DIMENSIONS_BOUSSOLE.map((d) => (
                <text key={d.label} className="dim-label" x={d.x} y={d.y} textAnchor={d.anchor}>
                  {d.label}
                </text>
              ))}
              <g className="needle">
                <polygon points="200,60 206,200 194,200" fill="#c9a24b" opacity="0.9" />
                <polygon points="200,340 206,200 194,200" fill="#3a4658" />
                <circle cx="200" cy="200" r="7" fill="#e0bd6f" />
              </g>
              <text className="iga-score" x="200" y="245" textAnchor="middle">IGA</text>
              <text className="iga-tag" x="200" y="266" textAnchor="middle">INDICE GÉNÉRAL D&apos;AUTONOMIE</text>
            </svg>
          </div>
        </div>
      </section>

      <section id="vision" className="vision">
        <div className="wrap">
          <div className="vision-grid">
            <div className="reveal">
              <span className="eyebrow">Notre conviction</span>
              <p className="vision-quote" style={{ marginTop: 18 }}>
                L&apos;autonomie ne se coche pas. <span>Elle se trace</span>, entretien après entretien, dimension après
                dimension.
              </p>
            </div>
            <div className="vision-body reveal">
              <p>
                Les professionnels du travail social et de l&apos;insertion portent une responsabilité rare : celle de
                témoigner, avec exactitude, du chemin parcouru par une personne. Trop d&apos;outils réduisent ce travail à
                des cases à cocher.
              </p>
              <p>
                <strong>PsychoÉduc Manager a été conçu à partir du terrain</strong>, pour restituer la complexité réelle
                d&apos;un accompagnement — logement, emploi, langue, famille, précarité financière, santé — sans jamais
                sacrifier la clarté.
              </p>
              <p>
                Parce que certains des publics accompagnés sont mineurs ou en situation de grande vulnérabilité, chaque
                fonctionnalité est pensée sous l&apos;angle de la conformité RGPD et de la sobriété visuelle : un outil
                professionnel, jamais ludique, à la hauteur du sérieux de la mission.
              </p>
              <p>
                Au fond, PsychoÉduc Manager est <strong>un outil de développement du capital humain</strong> : il donne une
                forme mesurable et actionnable au progrès d&apos;une personne, pour que chaque effort investi — le sien,
                celui de son accompagnant — se traduise en avancée réelle et visible.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="chemins">
        <div className="wrap">
          <div className="section-head reveal" style={{ maxWidth: 680 }}>
            <span className="eyebrow">Développer le capital humain</span>
            <h2>Deux chemins. Une même plateforme.</h2>
            <p>
              Au-delà des professionnels de l&apos;accompagnement, PsychoÉduc Manager s&apos;adresse aussi directement à
              celles et ceux qui veulent progresser — et à celles et ceux qui les y aident.
            </p>
          </div>

          <div className="dual-grid reveal">
            <div className="dual-card dual-gold">
              <div className="dual-mini-gauge">
                {/* Valeur d'illustration statique : aucun visiteur identifié sur une page publique,
                    pas de score IGA réel à afficher ici. */}
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(236,230,216,0.12)" strokeWidth="5" />
                  <circle
                    cx="40" cy="40" r="30" fill="none" stroke="#c9a24b" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray="188.5" strokeDashoffset="60" transform="rotate(-90 40 40)"
                  />
                  <text x="40" y="45" textAnchor="middle" fontFamily="var(--font-plex-mono), monospace" fontSize="14" fill="#ece6d8">68%</text>
                </svg>
              </div>
              <span className="dual-tag">POUR LES PARTICULIERS</span>
              <h3>Mesurez votre score IGA</h3>
              <p>
                Évaluez votre autonomie sur les 8 dimensions de vie, identifiez vos priorités, et accédez aux formations
                qui vous font réellement avancer.
              </p>
              <Link href="/mesurer-iga" className="btn-primary">Mesurer mon IGA</Link>
            </div>

            <div className="dual-card dual-vert">
              <span className="dual-tag">POUR LES FORMATEURS &amp; PRESTATAIRES</span>
              <h3>Vendez vos compétences</h3>
              <p>
                Rejoignez la marketplace et proposez vos formations, ateliers et accompagnements à des bénéficiaires en
                recherche active de progression.
              </p>
              <Link href="/inscription?type=solo" className="btn-vert">Passer à une autre dimension</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="plateforme">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">La plateforme</span>
            <h2>Un seul espace pour piloter chaque accompagnement, du premier entretien à la sortie.</h2>
            <p>Six modules, chacun avec un objectif précis — du diagnostic initial à la valorisation des résultats.</p>
          </div>
        </div>
        <div className="wrap">
          <div className="feat-grid reveal">
            {MODULES.map((m) => (
              <div key={m.num} className="feat-card">
                <span className="feat-num">{m.num}</span>
                <h3>{m.titre}</h3>
                <p>{m.texte}</p>
                <p className="feat-obj">
                  <strong>Objectif —</strong> {m.objectif}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="parcours" className="parcours">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">Le parcours d&apos;insertion</span>
            <h2>Six étapes. Un fil conducteur pour chaque bénéficiaire.</h2>
            <p>Le référentiel qui structure la plateforme — personnalisable selon votre méthodologie.</p>
          </div>
          <div className="path-track reveal">
            <div className="path-line" />
            <div className="path-steps">
              {ETAPES.map((e) => (
                <div key={e.idx} className="path-step">
                  <div className="path-dot" />
                  <span className="path-idx">{e.idx}</span>
                  <h4>{e.titre}</h4>
                  <p>{e.texte}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pour-qui">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">Pour qui</span>
            <h2>Trois façons de pratiquer, un seul outil.</h2>
          </div>
          <div className="aud-grid reveal">
            {AUDIENCES.map((a) => (
              <div key={a.tag} className="aud-card">
                <span className="aud-eyebrow">{a.tag}</span>
                <h3>{a.titre}</h3>
                <p>{a.texte}</p>
                <ul className="aud-list">
                  {a.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="confiance" className="trust">
        <div className="wrap">
          <div className="trust-grid">
            <div className="reveal">
              <span className="eyebrow">Confiance &amp; conformité</span>
              <h2 style={{ marginTop: 14, fontSize: '1.9rem' }}>
                Un outil bâti pour des publics qui ne peuvent pas se permettre l&apos;à-peu-près.
              </h2>
              <ul className="trust-list">
                <li><span>Conformité</span><strong>RGPD par conception</strong></li>
                <li><span>Traçabilité</span><strong>Chronologie horodatée &amp; inaltérable</strong></li>
                <li><span>Suppression</span><strong>Suppression logique, aucune perte accidentelle</strong></li>
                <li><span>Accès</span><strong>Droits fins par profil et par structure</strong></li>
              </ul>
            </div>
            <div className="reveal trust-badge">
              <span className="big">IGA</span>
              <span className="small">Indicateur de progression — pas un test psychométrique commercialisé</span>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-final" id="contact">
        <div className="wrap">
          <span className="eyebrow">Prêt à commencer</span>
          <h2>Donnez à votre accompagnement l&apos;outil que votre engagement mérite.</h2>
          <div className="hero-ctas">
            <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Demande de démonstration')}`} className="btn-primary">
              Demander une démonstration
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn-ghost">Nous écrire</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <BoussoleLogo small />
              <span>PsychoÉduc Manager</span>
            </div>
            <div className="foot-cols">
              <div className="foot-col">
                <h5>PLATEFORME</h5>
                <a href="#plateforme">Cockpit Fondateur</a>
                <a href="#plateforme">Entretiens</a>
                <a href="#plateforme">Marketplace</a>
              </div>
              <div className="foot-col">
                <h5>À PROPOS</h5>
                <a href="#vision">Notre vision</a>
                <a href="#parcours">Le parcours</a>
                <a href="#confiance">Confiance &amp; RGPD</a>
              </div>
              <div className="foot-col">
                <h5>CONTACT</h5>
                <a href="#contact">Demander une démo</a>
                <a href="#contact">Nous écrire</a>
              </div>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 PsychoÉduc Manager</span>
            <span>Conforme RGPD · Conçu pour les métiers de l&apos;accompagnement</span>
          </div>
        </div>
      </footer>

      <LandingReveal />
    </div>
  )
}

function BoussoleLogo({ small }: { small?: boolean }) {
  const size = small ? 22 : 26
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" stroke="#c9a24b" strokeWidth="1.2" />
      <circle cx="20" cy="20" r="2.4" fill="#c9a24b" />
      {!small && (
        <>
          <line x1="20" y1="4" x2="20" y2="10" stroke="#c9a24b" strokeWidth="1.2" />
          <line x1="20" y1="30" x2="20" y2="36" stroke="#5c6c82" strokeWidth="1" />
          <line x1="4" y1="20" x2="10" y2="20" stroke="#5c6c82" strokeWidth="1" />
          <line x1="30" y1="20" x2="36" y2="20" stroke="#5c6c82" strokeWidth="1" />
        </>
      )}
    </svg>
  )
}
