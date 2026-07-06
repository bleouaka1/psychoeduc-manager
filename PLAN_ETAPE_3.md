# Plan — Étape 3 : Clients — Solo, Structures, Employeurs

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 5. Les clients sont déjà tous dans `organisations` (Étape 1) ; cette étape n'ajoute que des tables complémentaires de détail, jamais de table `comptes_solo` séparée (interdit explicitement par le document).

## Conformité checklist de durabilité
1-6. Sans objet direct (pas d'IGA, pas d'argent, pas de bénéficiaires/mineurs ici).
2. Cloisonnement : couvert par T5 (test à 2 organisations).
7. Migrations additives uniquement — un seul fichier additif.

## Décision structurante à prendre (le document ne détaille pas les colonnes)
L'architecture v5 nomme les 3 tables de cette étape (`details_structures`, `details_employeurs`, `implantations`) sans en détailler les colonnes. Décision : colonnes minimales mais réalistes pour un premier usage (secteur d'activité, identifiants légaux, description, site web), avec un principe strict : **une seule implantation par défaut n'est pas suffisante** — `implantations` est en 1:N (une organisation peut avoir plusieurs sites), alors que `details_structures`/`details_employeurs` sont en 1:1 (une seule fiche de détail par organisation, complémentaire de la ligne `organisations` elle-même). Toute colonne supplémentaire découverte nécessaire plus tard s'ajoutera par migration additive (ALTER TABLE ADD COLUMN), jamais par recréation de table.

## Tâches

### T1 — `details_structures`
**Objectif** : `details_structures(id uuid PK, organisation_id uuid unique FK -> organisations, secteur_activite text, numero_agrement text, date_agrement date, responsable_nom text, responsable_fonction text, site_web text, description text, created_by, updated_by, created_at, updated_at)`.
**Vérification** : unique sur `organisation_id` (une seule fiche par organisation).

### T2 — `details_employeurs`
**Objectif** : `details_employeurs(id uuid PK, organisation_id uuid unique FK -> organisations, secteur_activite text, taille_entreprise text check(tpe/pme/grande_entreprise), numero_registre_commerce text, site_web text, description text, created_by, updated_by, created_at, updated_at)`.
**Vérification** : unique sur `organisation_id` ; CHECK rejette une taille hors liste.

### T3 — `implantations`
**Objectif** : `implantations(id uuid PK, organisation_id uuid FK -> organisations (1:N), pays text, ville text, adresse text, quartier text, latitude numeric, longitude numeric, est_siege boolean default false, created_by, updated_by, created_at, updated_at)`.
**Vérification** : une organisation peut avoir 2 implantations (pas de contrainte unique sur `organisation_id` seul) ; au plus une implantation `est_siege = true` par organisation (contrainte partielle unique).

### T4 — RLS + index + triggers + seed permissions
**Objectif** : RLS sur les 3 tables (lecture membres/fondateur, écriture via `peut_creer/modifier/supprimer` ou fondateur), index sur `organisation_id`, triggers `updated_at` + audit générique, seed `permissions` pour les modules `details_structures`/`details_employeurs`/`implantations` (fondateur + administrateur).
**Dépendances** : T1-T3.
**Vérification** : policies actives sur les 3 tables (`pg_policies`).

### T5 — Test de cloisonnement (obligatoire)
**Objectif** : 2 organisations, vérifier qu'aucune fuite de `details_structures`/`details_employeurs`/`implantations` n'est possible entre elles.
**Dépendances** : T4.
**Vérification** : script de test, 0 fuite détectée.

### T6 — Clôture d'étape
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre d'exécution
T1 → T2 → T3 → T4 → T5 → T6
