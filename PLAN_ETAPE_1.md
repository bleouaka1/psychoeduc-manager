# Plan — Étape 1 : Authentification, organisations et rôles

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 3.
Base de départ : Supabase vide (0 table). Mode d'exécution : autonome (psychoeduc-boucle), aucune validation intermédiaire.

## Conformité à la checklist de durabilité (7 principes)
1. Référentiel IGA versionné — sans objet ici (pas de table IGA en Étape 1).
2. Cloisonnement multi-organisations testé systématiquement — couvert par T11 et T14 (test à 2 comptes / 2 organisations, pas une vérification ponctuelle).
3. Logique métier découplée du fournisseur cloud — les fonctions RLS ci-dessous sont des règles d'accès Postgres natives (pattern Supabase standard), pas de la "logique métier critique" au sens du principe (calculs IGA, règles financières) : ce principe ne s'applique qu'à partir des étapes IGA/finances.
4. Argent en registre append-only — sans objet ici.
5. Documentation de transmissibilité — toute décision marquée "Décision structurante" ci-dessous est recopiée dans `DECISIONS_LOG.md` (T15).
6. Conformité données mineurs — sans objet ici (pas de table bénéficiaires en Étape 1).
7. Migrations additives uniquement — une seule migration additive, aucune suppression/renommage.

## Tâches

### T1 — Migration initiale et extensions
**Objectif** : créer `supabase/migrations/<timestamp>_etape1_socle_auth.sql`, activer `pgcrypto` (pour `gen_random_uuid()`).
**Dépendances** : aucune.
**Vérification** : `SELECT gen_random_uuid();` retourne un UUID après application de la migration.

### T2 — Table `profiles`
**Objectif** : `profiles(id uuid PK references auth.users(id) on delete cascade, nom text, prenoms text, email text, telephone text, photo_url text, created_at timestamptz default now(), updated_at timestamptz default now())`.
**Dépendances** : T1.
**Vérification** : `\d profiles` montre les colonnes attendues.
**Décision structurante** : `profiles.id` = `auth.users.id` directement (pas de `user_id` séparé) — pattern standard Supabase, évite une jointure supplémentaire partout. Alternative écartée : id propre + FK `user_id` (plus flexible en théorie, complexité inutile ici).

### T3 — Trigger de création automatique de profil
**Objectif** : trigger `on_auth_user_created` (AFTER INSERT ON `auth.users`) qui insère automatiquement la ligne `profiles` correspondante.
**Dépendances** : T2.
**Vérification** : créer un utilisateur test via l'API auth (`supabase.auth.admin.createUser`) → une ligne `profiles` avec le même `id` apparaît sans intervention manuelle.

### T4 — Table `organisations`
**Objectif** : `organisations(id uuid PK default gen_random_uuid(), nom text not null, type_organisation text not null check (type_organisation in ('solo','structure','centre','ong','ecole','employeur','entreprise','association','fondation')), pays text, ville text, created_by uuid references profiles(id), created_at timestamptz default now(), updated_at timestamptz default now())`.
**Dépendances** : T2.
**Vérification** : un INSERT avec un `type_organisation` hors liste est rejeté par le CHECK constraint.

### T5 — Table `membres_organisations`
**Objectif** : `membres_organisations(id uuid PK, organisation_id uuid FK -> organisations, profile_id uuid FK -> profiles, statut text check (statut in ('actif','invite','suspendu','retire')) default 'actif', created_by uuid, created_at, updated_by uuid, updated_at, unique(organisation_id, profile_id))`.
**Dépendances** : T4.
**Vérification** : un doublon (même organisation_id + profile_id) est rejeté par la contrainte unique ; une FK orpheline est rejetée.

### T6 — Table `roles_utilisateurs`
**Objectif** : `roles_utilisateurs(id uuid PK, membre_organisation_id uuid FK -> membres_organisations, role text check (role in (<19 rôles officiels de la section 3>)), actif boolean default true, created_by, created_at, updated_by, updated_at, unique(membre_organisation_id, role))`.
**Dépendances** : T5.
**Vérification** : un rôle hors liste officielle est rejeté ; un même membre peut avoir 2 rôles actifs simultanément (2 INSERT valides acceptés, ex. `formateur` + `coordinateur`).
**Décision structurante** : un membre peut cumuler plusieurs rôles dans une même organisation plutôt qu'un rôle unique porté directement par `membres_organisations`. Alternative écartée : rôle unique sur `membres_organisations.role` — plus simple, mais ne colle pas à la réalité terrain (une même personne cumule souvent plusieurs casquettes dans une petite structure).

### T7 — Table `permissions`
**Objectif** : `permissions(id uuid PK, role text check (enum des 19 rôles), module text not null, peut_lire boolean default false, peut_creer boolean default false, peut_modifier boolean default false, peut_supprimer boolean default false, created_at, updated_at, unique(role, module))`. Seed minimal : `fondateur` = accès total sur tous les modules connus à ce stade (`organisations`, `membres_organisations`, `roles_utilisateurs`, `permissions`, `audit_logs`) ; `beneficiaire` = lecture seule sur son propre module.
**Dépendances** : T1.
**Vérification** : requête SELECT confirme la présence du seed `fondateur`/`beneficiaire` pour les modules listés.

### T8 — Table `audit_logs`
**Objectif** : `audit_logs(id uuid PK, organisation_id uuid FK nullable, profile_id uuid FK nullable, action text not null, table_cible text not null, ligne_id uuid, donnees_avant jsonb, donnees_apres jsonb, created_at timestamptz default now())`. Pas de colonne `updated_at` — table append-only, jamais modifiée après écriture.
**Dépendances** : T2, T4.
**Vérification** : une tentative UPDATE ou DELETE par un rôle non-fondateur échoue (bloquée par RLS, voir T11).
**Point de vigilance explicite (section 2 du doc)** : `audit_logs` ne doit jamais s'auto-auditer — aucun trigger d'audit n'est posé sur `audit_logs` elle-même. Vérification : `SELECT * FROM pg_trigger WHERE tgrelid = 'audit_logs'::regclass` ne retourne aucun trigger de type audit.

### T9 — Fonctions RLS de base
**Objectif** : `is_fondateur() RETURNS boolean`, `est_membre_organisation(organisation_id uuid) RETURNS boolean`, `role_dans_organisation(organisation_id uuid) RETURNS SETOF text`, toutes en `SECURITY DEFINER`.
**Dépendances** : T5, T6.
**Vérification** : appelées sous un JWT de test fondateur → `is_fondateur()` = true ; sous un JWT membre standard → false, et `role_dans_organisation()` retourne exactement les rôles actifs attendus.
**Décision structurante** : fonctions en `SECURITY DEFINER` pour éviter la récursion RLS classique (une policy sur `membres_organisations` qui interroge `membres_organisations`). Alternative écartée : policies auto-référentes sans fonction dédiée — source connue de l'erreur Postgres "infinite recursion detected in policy".

### T10 — Fonctions de permission par module
**Objectif** : `peut_lire/peut_creer/peut_modifier/peut_supprimer(module text, organisation_id uuid) RETURNS boolean`, logique : `is_fondateur()` OR (`est_membre_organisation` ET au moins un rôle actif de l'utilisateur a le droit correspondant dans `permissions` pour ce module).
**Dépendances** : T7, T9.
**Vérification** : pour un rôle sans droit sur un module donné → false ; pour `fondateur` → toujours true, quel que soit le module/l'organisation.

### T11 — RLS complet sur les 6 tables
**Objectif** : activer RLS et poser les policies (SELECT/INSERT/UPDATE/DELETE selon pertinence) sur `profiles`, `organisations`, `membres_organisations`, `roles_utilisateurs`, `permissions`, `audit_logs`, scopées par organisation via T9/T10, fondateur = accès global.
**Dépendances** : T9, T10.
**Vérification (cloisonnement, obligatoire)** : créer 2 comptes dans 2 organisations différentes ; le compte A ne voit jamais les lignes de l'organisation B (SELECT vide) et ne peut pas y écrire (INSERT/UPDATE rejetés par RLS) ; le compte fondateur voit les deux organisations.

### T12 — Index et triggers `updated_at`
**Objectif** : index sur toutes les colonnes FK (`organisation_id`, `profile_id`, `membre_organisation_id`, `created_by`, `updated_by` partout où elles existent) ; fonction générique `set_updated_at()` déclenchée en trigger BEFORE UPDATE sur toutes les tables possédant `updated_at`.
**Dépendances** : T2 à T8.
**Vérification** : `\di` liste un index par FK ; un UPDATE sans spécifier `updated_at` met quand même à jour la colonne automatiquement.

### T13 — Trigger d'audit générique
**Objectif** : fonction `log_audit()` en trigger AFTER INSERT/UPDATE/DELETE sur `organisations`, `membres_organisations`, `roles_utilisateurs`, `permissions` (pas sur `profiles`, pas sur `audit_logs` elle-même) qui écrit une ligne dans `audit_logs`.
**Dépendances** : T8, T12.
**Vérification** : une modification sur `organisations` génère automatiquement une ligne `audit_logs` avec `donnees_avant`/`donnees_apres` cohérentes ; aucune ligne générée pour une modification sur `audit_logs` elle-même.

### T14 — Test de cloisonnement multi-organisations (obligatoire avant clôture)
**Objectif** : script de test (SQL ou TS) qui crée 2 organisations + 2 comptes, tente systématiquement une lecture/écriture croisée sur les 6 tables de l'étape, et rapporte tout accès non bloqué comme échec.
**Dépendances** : T11.
**Vérification** : le script s'exécute et rapporte 0 fuite détectée sur les 6 tables.

### T15 — Clôture d'étape
**Objectif** : mettre à jour `ETAT_PROJET.md` (Étape 1 → close si T1-T14 vertes) et recopier les décisions structurantes ci-dessus dans `DECISIONS_LOG.md`.
**Dépendances** : T1-T14.
**Vérification** : `ETAT_PROJET.md` reflète l'état réel de la base (requête de comptage des tables/policies) et non une simple déclaration.

## Ordre d'exécution
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14 → T15
