# Plan — Étape 9 : IGA (Indice Général d'Autonomie)

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 11. Données sensibles (évaluations psychologiques de bénéficiaires, potentiellement mineurs) : même vigilance renforcée qu'à l'Étape 5, avec la leçon apprise appliquée dès le départ (pas d'accès org-large pour le rôle `beneficiaire`).

## Conformité checklist de durabilité
1. **Référentiel IGA versionné** : `referentiels_iga` + `evaluations_iga.referentiel_version_id` obligatoire (FK not null), c'est le cœur de cette étape.
2. Cloisonnement multi-organisations : testé (T9), plus test spécifique "un bénéficiaire ne voit que ses propres évaluations/classement, jamais ceux des autres" (leçon de l'Étape 5).
3. Logique métier découplée : le calcul du score global à partir des scores par dimension reste un calcul simple (moyenne pondérée) fait en base pour la cohérence des données, mais la logique de recommandation/interprétation restera côté application TypeScript plus tard — pas de fonction Postgres imbriquée complexe ici.
6. Conformité mineurs : classements/top100 ne doivent jamais exposer les scores d'un bénéficiaire à un autre bénéficiaire — RLS spécifique (T9).
7. Migrations additives uniquement.

## Décisions structurantes à prendre
1. **`top100_iga` est une vue** (pas une table stockée) filtrant `classements_iga` où `rang <= 100` — évite une double source de vérité entre le classement complet et son extrait top 100.
2. **Un bénéficiaire ne voit jamais le classement/top100 des autres**, seulement sa propre ligne dans `classements_iga` (si présente) — appliqué dès la conception cette fois (pas de `peut_lire=true` org-large pour le rôle `beneficiaire` sur les modules IGA sensibles), en application directe de la leçon de l'Étape 5.
3. **`referentiels_iga`/`dimensions_iga`/`criteres_iga` sont des tables de référence globales** (pas de `organisation_id`) : lecture ouverte à tout authentifié (nécessaire pour construire un formulaire d'évaluation), écriture réservée au fondateur.
4. **Un seul référentiel `actif = true` à la fois**, appliqué par un index unique partiel (même pattern que "un seul siège" de l'Étape 3).
5. **`evaluations_iga` n'est pas append-only strict** (contrairement aux tables financières) : une évaluation reste modifiable par le personnel autorisé (ex. correction d'une erreur de saisie), tracée par l'audit générique — le principe absolu d'append-only du document ne s'applique explicitement qu'aux tables financières, pas aux évaluations.

## Tâches

### T1 — `referentiels_iga`
**Objectif** : `referentiels_iga(id uuid PK, version int not null unique, date_effet date not null, description text, actif boolean not null default false, created_by, created_at, updated_at)`. Index unique partiel : un seul `actif = true`.
**Vérification** : un 2e référentiel `actif=true` est rejeté ; seed initial : 1 référentiel version 1, actif.

### T2 — `dimensions_iga`
**Objectif** : `dimensions_iga(id uuid PK, referentiel_id FK, code text, nom text not null, description text, ordre int, poids numeric default 1, created_at, updated_at)`, unique(referentiel_id, code). Seed : les 12 dimensions officielles (projet_de_vie, discipline, competences_techniques, competences_cognitives, competences_socio_affectives, capital_social, employabilite, autonomie_economique, sante_hygiene, citoyennete, innovation, resilience) pour le référentiel version 1.
**Vérification** : exactement 12 dimensions présentes pour le référentiel actif.

### T3 — `criteres_iga`
**Objectif** : `criteres_iga(id uuid PK, dimension_id FK, code text, libelle text not null, description text, poids numeric default 1, ordre int, created_at, updated_at)`.
**Vérification** : FK vers une dimension existante obligatoire.

### T4 — `evaluations_iga`
**Objectif** : `evaluations_iga(id uuid PK, beneficiaire_id FK, organisation_id FK, referentiel_version_id uuid not null FK -> referentiels_iga, evalue_par uuid FK profiles, date_evaluation date default current_date, score_global numeric, niveau text check(dependance/autonomie_emergente/autonomie_fonctionnelle/autonomie_avancee/leadership_autonome), commentaire text, created_by, updated_by, created_at, updated_at)`.
**Vérification** : `referentiel_version_id` non nul obligatoire (insertion sans échoue) ; CHECK rejette un `niveau` hors liste.

### T5 — `scores_iga`, `indicateurs_iga`, `preuves_iga`, `recommandations_iga`
**Objectif** :
- `scores_iga(id, evaluation_id FK unique-par-dimension, dimension_id FK, score numeric check(0-100), created_at, updated_at)`, unique(evaluation_id, dimension_id).
- `indicateurs_iga(id, evaluation_id FK, critere_id FK, valeur numeric, note_sur_20 numeric, created_at, updated_at)`.
- `preuves_iga(id, evaluation_id FK, indicateur_id FK nullable, type_preuve text, url_fichier text, description text, televerse_par FK profiles, created_at, updated_at)`.
- `recommandations_iga(id, evaluation_id FK, dimension_id FK nullable, recommandation text, priorite text check(haute/moyenne/basse) default 'moyenne', statut text check(proposee/en_cours/realisee/abandonnee) default 'proposee', created_by, updated_by, created_at, updated_at)`.
**Vérification** : `scores_iga` rejette un doublon (evaluation_id, dimension_id) et un score hors 0-100.

### T6 — `historique_iga`
**Objectif** : `historique_iga(id, beneficiaire_id FK, organisation_id FK, mois date, score_global numeric, niveau text, referentiel_version_id FK, created_at)`, unique(beneficiaire_id, mois).
**Vérification** : unique par bénéficiaire et par mois.

### T7 — `classements_iga` + vue `top100_iga`
**Objectif** : `classements_iga(id, organisation_id FK nullable [null = classement plateforme], beneficiaire_id FK, periode_type text check(mensuel/annuel), periode date, rang int, score_global numeric, created_at)`. `top100_iga` = **vue** `security_invoker` sur `classements_iga` filtrant `rang <= 100`.
**Vérification** : la vue reflète bien un sous-ensemble de `classements_iga` (test avec rangs 1 à 150, la vue n'en retourne que 100).

### T8 — Index, triggers, seed permissions
**Objectif** : index FK, triggers `updated_at`+audit (sauf tables de référence globales `referentiels_iga`/`dimensions_iga`/`criteres_iga` où l'audit reste pertinent car modifiables par le fondateur). Seed `permissions` pour les rôles pertinents (`fondateur`, `administrateur`, `directeur`, `coordinateur`, `educateur`, `formateur`, `psychologue`, `assistant_social`) sur les modules IGA organisation-scopés. **Ne jamais donner `peut_lire=true` au rôle `beneficiaire`** sur `evaluations_iga`/`scores_iga`/`classements_iga` (leçon de l'Étape 5) — son accès passe exclusivement par une clause RLS dédiée "c'est sa propre évaluation/son propre classement".
**Dépendances** : T1-T7.

### T9 — RLS + test de cloisonnement renforcé (obligatoire)
**Objectif** : RLS sur toutes les tables. `evaluations_iga`/`scores_iga`/`historique_iga` : lecture staff org-scopée OU bénéficiaire lui-même restreint à SES PROPRES lignes (jointure sur `beneficiaires.profile_id = auth.uid()`). `classements_iga` : staff org-scopé voit tout ; un bénéficiaire ne voit que la ligne où `beneficiaire_id` correspond à sa propre fiche, jamais les autres lignes du classement (pas de fuite de rang/score d'un pair).
**Vérification (obligatoire)** :
- 2 organisations, 0 fuite d'évaluations/scores/classements entre elles.
- Un compte bénéficiaire ne voit que ses propres évaluations et sa propre ligne de classement, jamais celles d'un autre bénéficiaire de la même organisation (répétition explicite du test qui avait échoué à l'Étape 5, appliqué ici dès le départ).
- Contrainte "un seul référentiel actif" vérifiée.
- La vue `top100_iga` filtre bien `rang <= 100`.

### T10 — Clôture d'étape
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre d'exécution
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10
