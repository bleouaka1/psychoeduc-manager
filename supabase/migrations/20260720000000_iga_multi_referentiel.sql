-- IGA multi-référentiel : IGA-E (0-12), IGA-A (13-25), IGA-J (18-35), IGA-AD (35+)
-- Réf : PLAN_IGA_MULTI_REFERENTIEL.md, IGA_Philosophie_Vision_Globale.md,
-- IGA-J_Fiche_Mesure_v1.md, IGA_Fiches_Completes_E_A_AD.md.
-- Migration additive uniquement.

-- ============================================================================
-- T1 — referentiels_iga : passer d'un seul actif (versions successives) à
-- plusieurs référentiels actifs simultanément (instruments parallèles par tranche
-- d'âge, pas des versions qui se remplacent). `code` ajouté pour lookup
-- programmatique stable (le `version` int existant reste, mais n'est plus
-- l'identifiant fonctionnel).
-- ============================================================================
drop index if exists public.idx_referentiels_iga_un_seul_actif;

alter table public.referentiels_iga
  add column if not exists code text unique,
  add column if not exists tranche_age_min int,
  add column if not exists tranche_age_max int;

update public.referentiels_iga set code = 'legacy_12_dimensions' where version = 1 and code is null;

insert into public.referentiels_iga (version, code, date_effet, description, actif, tranche_age_min, tranche_age_max)
values
  (2, 'iga_e', current_date, 'IGA-E — Enfance (0-12 ans), 7 dimensions', true, 0, 12),
  (3, 'iga_a', current_date, 'IGA-A — Adolescents/Jeunes (13-25 ans), 6 dimensions', true, 13, 25),
  (4, 'iga_j', current_date, 'IGA-J — Jeunes adultes (18-35 ans), 8 dimensions', true, 18, 35),
  (5, 'iga_ad', current_date, 'IGA-AD — Adultes (35 ans et plus), 8 dimensions', true, 35, null)
on conflict (version) do nothing;

-- ============================================================================
-- T2 — criteres_iga.echelle : texte littéral complet des 5 points (0 à 4),
-- obligatoire par consigne explicite des fiches ("formulation complète, pas de
-- raccourci"). indicateurs_iga.score_brut : les nouvelles grilles ont des poids
-- de critère variables (/3 à /8), note_sur_20 ne peut plus être la source de
-- vérité — le score brut 0-4 saisi par le praticien l'est désormais.
-- ============================================================================
alter table public.criteres_iga add column if not exists echelle jsonb;
alter table public.indicateurs_iga add column if not exists score_brut int check (score_brut between 0 and 4);

-- criteres_iga n'avait aucune contrainte d'unicité (contrairement à dimensions_iga) —
-- nécessaire pour des seeds idempotents (on conflict do nothing) et pour éviter les doublons.
alter table public.criteres_iga add constraint criteres_iga_dimension_code_unique unique (dimension_id, code);

-- ============================================================================
-- T3 — Dimensions + critères, référentiel par référentiel
-- ============================================================================

-- ---------------------------------------------------------------------------
-- IGA-E — Enfance (0-12 ans), 7 dimensions
-- ---------------------------------------------------------------------------
insert into public.dimensions_iga (referentiel_id, code, nom, ordre, poids)
select r.id, d.code, d.nom, d.ordre, d.poids
from public.referentiels_iga r
cross join (values
  ('developpement_personnel','Développement personnel',1,15),
  ('habitudes_de_vie','Habitudes de vie',2,15),
  ('scolarite','Scolarité',3,20),
  ('socialisation','Socialisation',4,15),
  ('vie_familiale','Vie familiale',5,15),
  ('securite','Sécurité',6,10),
  ('developpement_cognitif','Développement cognitif',7,10)
) as d(code, nom, ordre, poids)
where r.code = 'iga_e'
on conflict (referentiel_id, code) do nothing;

insert into public.criteres_iga (dimension_id, code, libelle, poids, ordre, echelle)
select dim.id, c.code, c.libelle, c.poids, c.ordre, c.echelle::jsonb
from public.dimensions_iga dim
join public.referentiels_iga r on r.id = dim.referentiel_id and r.code = 'iga_e'
cross join lateral (values
  ('developpement_personnel','autonomie_quotidien','Autonomie dans les gestes du quotidien (s''habiller, manger seul, se laver selon l''âge)',4,1,
    '{"0":"dépendant total","1":"besoin d''aide constante","2":"aide partielle","3":"autonome avec rappels","4":"pleinement autonome pour son âge"}'),
  ('developpement_personnel','gestion_emotions','Gestion des émotions (colère, frustration, joie)',4,2,
    '{"0":"crises fréquentes incontrôlées","1":"difficultés fréquentes","2":"gestion irrégulière","3":"gestion globalement bonne","4":"bonne régulation émotionnelle"}'),
  ('developpement_personnel','estime_de_soi','Estime de soi / confiance',4,3,
    '{"0":"très faible","1":"fragile","2":"variable","3":"bonne","4":"solide"}'),
  ('developpement_personnel','responsabilisation','Responsabilisation (petites tâches, engagements)',3,4,
    '{"0":"aucune","1":"rare","2":"occasionnelle","3":"régulière","4":"constante et fiable"}'),
  ('habitudes_de_vie','hygiene','Hygiène',4,1,
    '{"0":"négligée","1":"avec rappel constant","2":"irrégulière","3":"bonne","4":"autonome et bonne"}'),
  ('habitudes_de_vie','sommeil','Sommeil (régularité, quantité adaptée à l''âge)',4,2,
    '{"0":"très perturbé/insuffisant","1":"irrégulier avec rappel","2":"correct mais irrégulier","3":"régulier","4":"régulier et autonome"}'),
  ('habitudes_de_vie','alimentation','Alimentation (régularité, équilibre)',4,3,
    '{"0":"très déséquilibrée/irrégulière","1":"irrégulière","2":"correcte mais limitée","3":"régulière et équilibrée","4":"régulière, équilibrée et autonome"}'),
  ('habitudes_de_vie','ponctualite_routines','Ponctualité / respect des routines',3,4,
    '{"0":"aucun respect","1":"rare","2":"irrégulier","3":"bon","4":"constant et autonome"}'),
  ('scolarite','assiduite','Assiduité',4,1,
    '{"0":"absentéisme fréquent","1":"absences répétées","2":"présence irrégulière","3":"bonne présence","4":"assiduité exemplaire"}'),
  ('scolarite','resultats','Résultats scolaires',5,2,
    '{"0":"grande difficulté","1":"en difficulté","2":"moyens","3":"bons","4":"excellents"}'),
  ('scolarite','motivation','Motivation / attitude face à l''apprentissage',4,3,
    '{"0":"rejet","1":"désintérêt","2":"neutre","3":"intéressé","4":"motivé et curieux"}'),
  ('scolarite','relation_enseignants','Relation avec les enseignants',4,4,
    '{"0":"conflictuelle","1":"tendue","2":"correcte","3":"bonne","4":"très bonne"}'),
  ('scolarite','respect_cadre','Respect des consignes et du cadre scolaire',3,5,
    '{"0":"aucun respect","1":"rare","2":"irrégulier","3":"bon","4":"exemplaire"}'),
  ('socialisation','relations_pairs','Relations avec les pairs (amitié, jeu collectif)',5,1,
    '{"0":"isolement/rejet","1":"difficultés fréquentes","2":"relations limitées","3":"bonnes relations","4":"très bonnes relations, apprécié"}'),
  ('socialisation','respect_autorite','Respect de l''autorité et des règles collectives',5,2,
    '{"0":"aucun respect","1":"difficultés fréquentes","2":"respect irrégulier","3":"bon respect","4":"respect exemplaire"}'),
  ('socialisation','empathie','Empathie / capacité à partager',5,3,
    '{"0":"absente","1":"rare","2":"variable","3":"bonne","4":"solide"}'),
  ('vie_familiale','lien_parental','Qualité du lien avec les figures parentales/tutrices',8,1,
    '{"0":"rupture/conflit grave","1":"relation tendue","2":"relation correcte","3":"relation bonne","4":"relation solide et sécurisante"}'),
  ('vie_familiale','stabilite_familiale','Stabilité de l''environnement familial (présence, continuité)',7,2,
    '{"0":"instabilité grave","1":"instabilité fréquente","2":"stabilité partielle","3":"bonne stabilité","4":"stabilité pleine et continue"}'),
  ('securite','protection_risques','Protection contre les risques (maltraitance, exploitation, négligence)',6,1,
    '{"0":"situation à risque avéré","1":"signaux préoccupants","2":"vigilance nécessaire","3":"environnement globalement sûr","4":"environnement pleinement sécurisant"}'),
  ('securite','acces_besoins_base','Accès aux besoins de base (soins, nutrition, abri)',4,2,
    '{"0":"manque essentiel","1":"accès partiel et instable","2":"accès correct mais irrégulier","3":"accès stable","4":"accès stable et confortable"}'),
  ('developpement_cognitif','langage','Langage et communication adaptés à l''âge',5,1,
    '{"0":"retard marqué","1":"retard léger","2":"développement moyen","3":"bon développement","4":"développement avancé"}'),
  ('developpement_cognitif','concentration','Capacités de concentration et de raisonnement adaptées à l''âge',5,2,
    '{"0":"retard marqué","1":"retard léger","2":"développement moyen","3":"bon développement","4":"développement avancé"}')
) as c(dim_code, code, libelle, poids, ordre, echelle)
where dim.code = c.dim_code
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- IGA-A — Adolescents/Jeunes (13-25 ans), 6 dimensions
-- Rédigé par Claude Code sur le modèle littéral d'IGA-E/J/AD à partir des
-- descriptions sommaires transmises (IGA_Fiches_Completes_E_A_AD.md §IGA-A) —
-- SOUMIS À VALIDATION D'ANGENOR, cf. PLAN_IGA_MULTI_REFERENTIEL.md.
-- ---------------------------------------------------------------------------
insert into public.dimensions_iga (referentiel_id, code, nom, ordre, poids)
select r.id, d.code, d.nom, d.ordre, d.poids
from public.referentiels_iga r
cross join (values
  ('autonomie_personnelle','Autonomie personnelle',1,20),
  ('autonomie_sociale','Autonomie sociale',2,15),
  ('autonomie_educative_professionnelle','Autonomie éducative/professionnelle',3,20),
  ('autonomie_economique','Autonomie économique',4,15),
  ('insertion_socioprofessionnelle','Insertion socioprofessionnelle',5,15),
  ('capital_social','Capital social',6,15)
) as d(code, nom, ordre, poids)
where r.code = 'iga_a'
on conflict (referentiel_id, code) do nothing;

insert into public.criteres_iga (dimension_id, code, libelle, poids, ordre, echelle)
select dim.id, c.code, c.libelle, c.poids, c.ordre, c.echelle::jsonb
from public.dimensions_iga dim
join public.referentiels_iga r on r.id = dim.referentiel_id and r.code = 'iga_a'
cross join lateral (values
  ('autonomie_personnelle','hygiene_tenue','Hygiène et tenue vestimentaire adaptée',4,1,
    '{"0":"négligée, jamais corrigée seul","1":"correcte seulement si rappelée","2":"correcte mais irrégulière","3":"correcte et régulière","4":"correcte, régulière et autonome"}'),
  ('autonomie_personnelle','sante_sommeil','Santé et gestion du sommeil',4,2,
    '{"0":"aucun suivi, sommeil très perturbé","1":"suivi rare, sommeil irrégulier","2":"suivi irrégulier, sommeil correct","3":"suivi régulier, sommeil correct","4":"suivi actif, sommeil régulier et adapté"}'),
  ('autonomie_personnelle','alimentation_ponctualite','Alimentation et ponctualité',4,3,
    '{"0":"alimentation très déséquilibrée, retards constants","1":"irrégulière, retards fréquents","2":"correcte, ponctualité irrégulière","3":"correcte et régulière, ponctuel la plupart du temps","4":"équilibrée et régulière, ponctuel"}'),
  ('autonomie_personnelle','regles_emotions','Respect des règles et gestion des émotions',4,4,
    '{"0":"transgressions fréquentes, crises incontrôlées","1":"difficultés fréquentes","2":"gestion irrégulière","3":"gestion globalement bonne","4":"gestion et respect constants"}'),
  ('autonomie_personnelle','responsabilite_organisation','Responsabilité et organisation quotidienne',4,5,
    '{"0":"aucune organisation, aucun engagement tenu","1":"rare","2":"partielle et irrégulière","3":"bonne, engagements globalement tenus","4":"solide, engagements toujours tenus"}'),
  ('autonomie_sociale','communication_respect','Communication et respect d''autrui',4,1,
    '{"0":"communication conflictuelle, aucun respect","1":"difficultés fréquentes","2":"correcte mais inégale","3":"bonne communication et respect","4":"communication claire, respect constant"}'),
  ('autonomie_sociale','equipe_conflits','Travail en équipe et résolution des conflits',4,2,
    '{"0":"incapacité à collaborer, conflits non gérés","1":"difficultés fréquentes","2":"collaboration correcte, conflits parfois gérés","3":"bonne collaboration, conflits généralement résolus","4":"collaboration active, résolution autonome des conflits"}'),
  ('autonomie_sociale','autorite_empathie','Respect de l''autorité et empathie',4,3,
    '{"0":"opposition systématique, aucune empathie","1":"difficultés fréquentes","2":"respect irrégulier, empathie variable","3":"bon respect, empathie présente","4":"respect constant, empathie solide"}'),
  ('autonomie_sociale','reseau_participation','Réseau social positif et participation communautaire',3,4,
    '{"0":"isolement, aucune participation","1":"réseau très limité, participation passive","2":"réseau correct, participation occasionnelle","3":"bon réseau, participation régulière","4":"réseau solide, participation active"}'),
  ('autonomie_educative_professionnelle','presence_assiduite','Présence et assiduité',4,1,
    '{"0":"absentéisme fréquent","1":"absences répétées","2":"présence irrégulière","3":"bonne présence","4":"assiduité exemplaire"}'),
  ('autonomie_educative_professionnelle','motivation_participation','Motivation et participation',4,2,
    '{"0":"rejet, aucune participation","1":"désintérêt","2":"participation neutre","3":"motivé, participe régulièrement","4":"motivé, moteur du groupe"}'),
  ('autonomie_educative_professionnelle','qualite_consignes','Qualité du travail et respect des consignes',4,3,
    '{"0":"travail très insuffisant, consignes ignorées","1":"travail faible, consignes rarement suivies","2":"travail moyen, consignes suivies irrégulièrement","3":"bon travail, consignes suivies","4":"excellent travail, consignes toujours suivies"}'),
  ('autonomie_educative_professionnelle','initiative_perseverance','Initiative et persévérance',4,4,
    '{"0":"aucune initiative, abandon rapide","1":"initiative rare","2":"initiative occasionnelle","3":"initiative régulière, persévérant","4":"initiative constante, persévérance solide face aux échecs"}'),
  ('autonomie_educative_professionnelle','competences_materiel','Acquisition des compétences et gestion du matériel',4,5,
    '{"0":"aucune progression, matériel non entretenu","1":"progression rare","2":"progression occasionnelle","3":"progression régulière, matériel bien géré","4":"progression structurée, matériel géré avec soin"}'),
  ('autonomie_economique','gestion_budget','Gestion de l''argent et budget',4,1,
    '{"0":"aucune gestion, aucun suivi","1":"suivi mental approximatif","2":"suivi partiel","3":"budget établi et globalement suivi","4":"budget rigoureux et respecté"}'),
  ('autonomie_economique','epargne','Épargne',4,2,
    '{"0":"aucune épargne, dettes actives","1":"pas d''épargne, pas de dette","2":"épargne symbolique irrégulière","3":"épargne régulière modeste","4":"épargne régulière et substantielle"}'),
  ('autonomie_economique','cout_vie_consommation','Compréhension du coût de la vie et habitudes de consommation',4,3,
    '{"0":"aucune notion du coût de la vie","1":"notion vague, dépenses impulsives fréquentes","2":"notion correcte, dépenses parfois maîtrisées","3":"bonne compréhension, consommation raisonnée","4":"compréhension solide, consommation toujours maîtrisée"}'),
  ('autonomie_economique','recherche_revenus','Recherche de revenus',3,4,
    '{"0":"aucune démarche","1":"démarche rare et peu structurée","2":"démarche occasionnelle","3":"démarche régulière","4":"démarche active avec résultats concrets"}'),
  ('insertion_socioprofessionnelle','projet_professionnel','Projet professionnel',4,1,
    '{"0":"aucun projet","1":"idée vague non formalisée","2":"projet formalisé, peu avancé","3":"projet en cours d''exécution","4":"projet avancé avec résultats concrets"}'),
  ('insertion_socioprofessionnelle','recherche_stage_cv','Recherche de stage/emploi (CV, entretien)',4,2,
    '{"0":"aucune démarche, pas de CV","1":"CV existant mais démarche très rare","2":"démarche occasionnelle, CV correct","3":"démarche régulière, CV et entretien préparés","4":"démarche active et structurée, résultats obtenus"}'),
  ('insertion_socioprofessionnelle','reseau_professionnel','Réseau professionnel',4,3,
    '{"0":"aucun réseau","1":"réseau passif","2":"réseau limité mais utile","3":"réseau actif","4":"réseau actif et mobilisable"}'),
  ('insertion_socioprofessionnelle','stabilite_stage','Stabilité en stage/emploi',3,4,
    '{"0":"aucune stabilité, ruptures fréquentes","1":"très instable","2":"stabilité correcte mais fragile","3":"stable","4":"stable et reconnu/évolutif"}'),
  ('capital_social','relations_familiales','Relations familiales',4,1,
    '{"0":"ruptures/conflits majeurs","1":"relations tendues","2":"relations correctes","3":"relations bonnes","4":"relations bonnes et soutenantes"}'),
  ('capital_social','educateurs_employeurs','Relations avec éducateurs/employeurs',4,2,
    '{"0":"conflictuelles","1":"tendues","2":"correctes","3":"bonnes","4":"bonnes et soutenantes"}'),
  ('capital_social','voisins_amis','Relations avec voisins/amis',4,3,
    '{"0":"absentes/conflictuelles","1":"limitées et tendues","2":"correctes","3":"bonnes","4":"bonnes et solides"}'),
  ('capital_social','ressources_associatif','Personnes ressources mobilisables et participation associative',3,4,
    '{"0":"aucune personne ressource, aucune participation","1":"très limité","2":"quelques ressources, participation occasionnelle","3":"bonnes ressources, participation régulière","4":"ressources solides, participation active"}')
) as c(dim_code, code, libelle, poids, ordre, echelle)
where dim.code = c.dim_code
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- IGA-J — Jeunes adultes (18-35 ans), 8 dimensions
-- ---------------------------------------------------------------------------
insert into public.dimensions_iga (referentiel_id, code, nom, ordre, poids)
select r.id, d.code, d.nom, d.ordre, d.poids
from public.referentiels_iga r
cross join (values
  ('autonomie_economique','Autonomie économique',1,20),
  ('logement','Logement',2,10),
  ('emploi_activite','Emploi / activité professionnelle',3,15),
  ('sante','Santé',4,10),
  ('vie_citoyenne','Vie citoyenne',5,5),
  ('relations_affectives','Relations affectives',6,10),
  ('parentalite','Parentalité',7,10),
  ('developpement_professionnel','Développement professionnel',8,20)
) as d(code, nom, ordre, poids)
where r.code = 'iga_j'
on conflict (referentiel_id, code) do nothing;

insert into public.criteres_iga (dimension_id, code, libelle, poids, ordre, echelle)
select dim.id, c.code, c.libelle, c.poids, c.ordre, c.echelle::jsonb
from public.dimensions_iga dim
join public.referentiels_iga r on r.id = dim.referentiel_id and r.code = 'iga_j'
cross join lateral (values
  ('autonomie_economique','revenu_logement','Revenu couvre le logement',4,1,
    '{"0":"ne peut pas payer seul","1":"paie avec aide régulière","2":"paie seul mais avec tension","3":"paie seul confortablement","4":"paie seul + capacité d''épargne dessus"}'),
  ('autonomie_economique','revenu_habillement','Revenu couvre l''habillement',4,2,
    '{"0":"ne peut pas payer seul","1":"paie avec aide régulière","2":"paie seul mais avec tension","3":"paie seul confortablement","4":"paie seul + capacité d''épargne dessus"}'),
  ('autonomie_economique','aide_famille','Capacité à aider la famille sans se mettre en difficulté',4,3,
    '{"0":"ne peut pas aider","1":"aide mais s''endette pour ça","2":"aide occasionnellement, à l''équilibre","3":"aide régulièrement sans tension","4":"aide + épargne malgré tout"}'),
  ('autonomie_economique','epargne_reelle','Épargne réelle constituée',4,4,
    '{"0":"aucune épargne, dettes actives","1":"pas d''épargne, pas de dette","2":"épargne symbolique irrégulière","3":"épargne régulière modeste","4":"épargne substantielle et régulière"}'),
  ('autonomie_economique','gestion_budgetaire','Gestion budgétaire (suivi des dépenses)',4,5,
    '{"0":"aucun suivi","1":"suivi mental approximatif","2":"suivi partiel","3":"budget établi et suivi la plupart du temps","4":"budget rigoureux et respecté"}'),
  ('logement','stabilite_logement','Stabilité du logement',4,1,
    '{"0":"hébergé sans autonomie","1":"hébergement précaire","2":"logement stable mais dépendant (famille)","3":"logement autonome mais fragile","4":"logement autonome et stable"}'),
  ('logement','qualite_logement','Qualité de vie dans le logement (accès eau, électricité, sécurité)',3,2,
    '{"0":"manque essentiel","1":"accès partiel et instable","2":"accès correct mais irrégulier","3":"accès stable","4":"accès stable et confortable"}'),
  ('logement','charges_logement','Capacité à assumer seul les charges du logement (loyer, eau, courant)',3,3,
    '{"0":"ne peut pas","1":"avec aide constante","2":"avec aide ponctuelle","3":"seul, à l''équilibre serré","4":"seul, confortablement"}'),
  ('emploi_activite','stabilite_emploi','Stabilité de l''emploi/activité',4,1,
    '{"0":"sans activité","1":"activité très précaire","2":"activité correcte mais incertaine","3":"emploi stable","4":"emploi stable + reconnu/évolutif"}'),
  ('emploi_activite','satisfaction_sens','Satisfaction et sens dans le travail',4,2,
    '{"0":"aucun sens perçu","1":"subi","2":"neutre","3":"plutôt satisfaisant","4":"pleinement aligné avec ses valeurs"}'),
  ('emploi_activite','revenu_activite','Revenu de l''activité principale',4,3,
    '{"0":"insuffisant pour survivre","1":"survie difficile","2":"survie correcte","3":"confortable","4":"confortable + marge"}'),
  ('emploi_activite','diversification_revenus','Diversification des sources de revenu',3,4,
    '{"0":"une seule source fragile","1":"une source stable seulement","2":"début de diversification","3":"2 sources actives","4":"plusieurs sources solides"}'),
  ('sante','etat_physique','État de santé physique général',4,1,
    '{"0":"état préoccupant, non suivi","1":"problèmes non traités","2":"état correct, suivi irrégulier","3":"bon état, suivi régulier","4":"excellent état, suivi préventif"}'),
  ('sante','acces_alimentation','Accès à l''alimentation régulière et suffisante',3,2,
    '{"0":"privation fréquente (moins d''un repas/jour)","1":"alimentation irrégulière","2":"alimentation correcte mais limitée","3":"alimentation régulière et suffisante","4":"alimentation régulière, suffisante et équilibrée"}'),
  ('sante','bien_etre_psy','Bien-être psychologique',3,3,
    '{"0":"détresse marquée, pas de soutien","1":"difficultés fréquentes, peu de soutien","2":"difficultés gérées seul","3":"équilibre globalement bon","4":"équilibre bon + soutien identifié en cas de besoin"}'),
  ('vie_citoyenne','situation_administrative','Situation administrative en règle (pièces d''identité, statut légal)',3,1,
    '{"0":"aucun document en règle","1":"documents partiels","2":"en cours de régularisation","3":"documents essentiels en règle","4":"situation administrative complète"}'),
  ('vie_citoyenne','participation_citoyenne','Participation citoyenne/communautaire',2,2,
    '{"0":"aucune","1":"passive","2":"occasionnelle","3":"régulière","4":"engagée activement"}'),
  ('relations_affectives','stabilite_couple','Stabilité de la vie affective/relation de couple (si en couple)',5,1,
    '{"0":"relation en crise constante","1":"relation instable","2":"relation correcte avec tensions","3":"relation stable","4":"relation stable et épanouissante"}'),
  ('relations_affectives','relations_familiales_proches','Qualité des relations familiales proches',5,2,
    '{"0":"ruptures/conflits majeurs","1":"relations tendues","2":"relations correctes","3":"relations bonnes","4":"relations bonnes et soutenantes"}'),
  ('parentalite','subvenir_besoins_enfant','Capacité à subvenir aux besoins de l''enfant',5,1,
    '{"0":"incapable","1":"avec grande difficulté","2":"avec tension","3":"sans tension majeure","4":"confortablement"}'),
  ('parentalite','implication_lien','Implication et lien parent-enfant',5,2,
    '{"0":"absent/rompu","1":"faible et irrégulier","2":"correct","3":"bon","4":"solide et épanouissant"}'),
  ('developpement_professionnel','progression_competences','Progression de compétences (formation continue, apprentissage actif)',4,1,
    '{"0":"aucune progression","1":"apprentissage passif rare","2":"apprentissage occasionnel","3":"apprentissage régulier","4":"apprentissage régulier et structuré"}'),
  ('developpement_professionnel','projet_pro_action','Projet professionnel/entrepreneurial clair et en action',5,2,
    '{"0":"aucun projet","1":"idée non formalisée","2":"projet formalisé, peu avancé","3":"projet en cours d''exécution réel","4":"projet avancé avec résultats concrets"}'),
  ('developpement_professionnel','reseau_professionnel','Réseau professionnel actif',4,3,
    '{"0":"aucun réseau","1":"réseau passif","2":"réseau limité mais utile","3":"réseau actif","4":"réseau actif et mobilisable"}'),
  ('developpement_professionnel','reconnaissance_credibilite','Reconnaissance/crédibilité dans son domaine',4,4,
    '{"0":"aucune","1":"émergente","2":"locale limitée","3":"reconnue dans son cercle","4":"reconnue au-delà de son cercle immédiat"}'),
  ('developpement_professionnel','initiative_risque','Capacité d''initiative et prise de risque mesurée',3,5,
    '{"0":"évite toute initiative","1":"initiative rare","2":"initiative occasionnelle","3":"initiative régulière et réfléchie","4":"initiative régulière avec apprentissage des échecs passés"}')
) as c(dim_code, code, libelle, poids, ordre, echelle)
where dim.code = c.dim_code
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- IGA-AD — Adultes (35 ans et plus), 8 dimensions
-- ---------------------------------------------------------------------------
insert into public.dimensions_iga (referentiel_id, code, nom, ordre, poids)
select r.id, d.code, d.nom, d.ordre, d.poids
from public.referentiels_iga r
cross join (values
  ('sante','Santé',1,15),
  ('vie_familiale','Vie familiale',2,15),
  ('situation_financiere','Situation financière',3,20),
  ('emploi_activite','Emploi / activité',4,15),
  ('reseau_social','Réseau social',5,10),
  ('gestion_administrative','Gestion administrative',6,10),
  ('bien_etre_psychologique','Bien-être psychologique',7,10),
  ('preparation_avenir','Préparation de l''avenir',8,5)
) as d(code, nom, ordre, poids)
where r.code = 'iga_ad'
on conflict (referentiel_id, code) do nothing;

insert into public.criteres_iga (dimension_id, code, libelle, poids, ordre, echelle)
select dim.id, c.code, c.libelle, c.poids, c.ordre, c.echelle::jsonb
from public.dimensions_iga dim
join public.referentiels_iga r on r.id = dim.referentiel_id and r.code = 'iga_ad'
cross join lateral (values
  ('sante','etat_physique_suivi','État de santé physique et suivi médical',5,1,
    '{"0":"problèmes non suivis","1":"suivi rare","2":"suivi irrégulier","3":"suivi régulier","4":"suivi préventif actif"}'),
  ('sante','habitudes_vie','Habitudes de vie (alimentation, sommeil, activité physique)',5,2,
    '{"0":"très déséquilibrées","1":"peu adaptées","2":"correctes mais irrégulières","3":"bonnes et régulières","4":"excellentes et régulières"}'),
  ('sante','autonomie_maladie','Autonomie face à la maladie/gestion du corps avec l''âge',5,3,
    '{"0":"aucune autonomie, dépendant","1":"faible autonomie","2":"autonomie partielle","3":"bonne autonomie","4":"pleine autonomie et anticipation"}'),
  ('vie_familiale','relation_couple','Qualité de la relation de couple (si en couple)',5,1,
    '{"0":"crise constante","1":"instable","2":"correcte","3":"bonne","4":"épanouissante"}'),
  ('vie_familiale','relation_enfants','Relation avec les enfants (si concerné)',5,2,
    '{"0":"rompue/conflictuelle","1":"tendue","2":"correcte","3":"bonne","4":"solide et épanouissante"}'),
  ('vie_familiale','relation_famille_elargie','Relation avec la famille élargie (parents, fratrie)',5,3,
    '{"0":"rompue/conflictuelle","1":"tendue","2":"correcte","3":"bonne","4":"solide et soutenante"}'),
  ('situation_financiere','stabilite_revenus','Stabilité des revenus',5,1,
    '{"0":"très instable","1":"instable","2":"correcte","3":"stable","4":"stable et croissante"}'),
  ('situation_financiere','epargne_investissement','Épargne et capacité d''investissement',5,2,
    '{"0":"aucune épargne, dettes actives","1":"pas d''épargne, pas de dette","2":"épargne symbolique","3":"épargne régulière","4":"épargne substantielle et investissement actif"}'),
  ('situation_financiere','gestion_dettes','Gestion des dettes (absence ou maîtrise)',5,3,
    '{"0":"dettes non maîtrisées","1":"dettes sous tension","2":"dettes gérées difficilement","3":"dettes maîtrisées","4":"aucune dette / gérée sereinement"}'),
  ('situation_financiere','soutien_famille_elargie','Capacité à subvenir aux besoins de la famille élargie (parents, etc.)',5,4,
    '{"0":"incapable","1":"avec grande difficulté","2":"avec tension","3":"sans tension majeure","4":"confortablement"}'),
  ('emploi_activite','stabilite_professionnelle','Stabilité professionnelle',5,1,
    '{"0":"sans activité","1":"activité très précaire","2":"activité correcte mais incertaine","3":"emploi stable","4":"emploi stable et reconnu"}'),
  ('emploi_activite','evolution_reconnaissance','Évolution de carrière / reconnaissance',5,2,
    '{"0":"aucune évolution","1":"évolution rare","2":"évolution modérée","3":"bonne évolution","4":"évolution notable et reconnue"}'),
  ('emploi_activite','satisfaction_sens','Satisfaction et sens dans l''activité',5,3,
    '{"0":"aucun sens perçu","1":"subi","2":"neutre","3":"plutôt satisfaisant","4":"pleinement aligné avec ses valeurs"}'),
  ('reseau_social','qualite_reseau','Qualité et solidité du réseau amical/professionnel',5,1,
    '{"0":"aucun réseau","1":"réseau très limité","2":"réseau correct","3":"bon réseau","4":"réseau solide et actif"}'),
  ('reseau_social','personnes_ressources','Personnes ressources mobilisables en cas de besoin',5,2,
    '{"0":"aucune","1":"très limitées","2":"quelques-unes","3":"plusieurs","4":"nombreuses et fiables"}'),
  ('gestion_administrative','papiers_statuts','Papiers et statuts légaux en règle',5,1,
    '{"0":"aucun document en règle","1":"documents partiels","2":"en cours de régularisation","3":"documents essentiels en règle","4":"situation administrative complète"}'),
  ('gestion_administrative','suivi_obligations','Suivi des obligations (impôts, assurances, contrats)',5,2,
    '{"0":"aucun suivi","1":"suivi très irrégulier","2":"suivi partiel","3":"bon suivi","4":"suivi rigoureux et à jour"}'),
  ('bien_etre_psychologique','equilibre_emotionnel','Équilibre émotionnel général',5,1,
    '{"0":"détresse marquée","1":"difficultés fréquentes","2":"gestion seule difficile","3":"équilibre globalement bon","4":"équilibre solide"}'),
  ('bien_etre_psychologique','acces_soutien','Accès à un soutien en cas de besoin (professionnel ou personnel)',5,2,
    '{"0":"aucun soutien identifié","1":"soutien très limité","2":"soutien partiel","3":"bon soutien identifié","4":"soutien solide et mobilisable"}'),
  ('preparation_avenir','anticipation','Anticipation (retraite, projets long terme, transmission)',5,1,
    '{"0":"aucune anticipation","1":"pensée vague","2":"début de plan","3":"plan structuré","4":"plan structuré et en cours de réalisation"}')
) as c(dim_code, code, libelle, poids, ordre, echelle)
where dim.code = c.dim_code
on conflict do nothing;
