# Plan — Étape 2 : SaaS commercial

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 4. Socle Étape 1 en place (voir `PLAN_ETAPE_1.md`).

## Conformité checklist de durabilité
1. IGA versionné — sans objet ici.
2. Cloisonnement multi-org — couvert par T9 (test à 2 comptes/2 organisations), comme en Étape 1.
3. Logique métier découplée — le calcul du solde fondateur est une simple somme SQL (vue), pas une règle métier complexe ; les règles de facturation/relance restent pour le futur code applicatif TypeScript, pas dans des fonctions Postgres profondément imbriquées.
4. Argent append-only — **décision structurante centrale de cette étape**, voir T4 et T7.
5. Documentation transmissibilité — toutes les décisions ci-dessous recopiées dans `DECISIONS_LOG.md` (T10).
6. Conformité mineurs — sans objet ici (pas de données de bénéficiaires).
7. Migrations additives — un seul fichier additif, aucune suppression.

## Tension architecturale identifiée (à documenter, pas à bloquer)
La section "base officielle" de l'architecture v5 liste `mouvements_financiers` comme table du socle, mais sa construction dédiée est l'Étape 15, reportée après l'Étape 2 dans l'ordre V1. Or `wallet_fondateur` ne doit jamais stocker de solde directement (principe absolu section 2), il doit être recalculé depuis un registre de mouvements. **Décision** : construire dès l'Étape 2 un registre `transactions_wallet` dédié au wallet fondateur (append-only), et faire de `wallet_fondateur` une vue calculée dessus. À l'Étape 15, `mouvements_financiers` deviendra le registre général ; `transactions_wallet` sera alors soit fusionné dedans (migration additive : ajouter, faire coexister, déprécier), soit conservé comme vue spécialisée alimentée par `mouvements_financiers` — décision reportée à ce moment-là, sans perte de données possible entre-temps.

## Tâches

### T1 — Table `licences`
**Objectif** : `licences(id uuid PK, organisation_id uuid unique FK -> organisations, type_licence text check(solo/structure/employeur), statut text check(essai_gratuit/actif/expire/suspendu/archive) default 'essai_gratuit', modules_autorises text[] default '{}', limite_utilisateurs int, limite_beneficiaires int, limite_stockage_mo int, date_debut timestamptz default now(), date_fin timestamptz, created_by, created_at, updated_at)`. Unique sur `organisation_id` (une licence par organisation).
**Vérification** : contrainte unique empêche 2 licences pour la même organisation ; CHECK rejette un statut/type hors liste.

### T2 — Auto-création de la licence d'essai à la création d'une organisation
**Objectif** : trigger `on_organisation_created_licence` (AFTER INSERT ON `organisations`) qui crée automatiquement une licence `essai_gratuit` (type déduit de `type_organisation` : solo→solo, structure/centre/ong/ecole/association/fondation→structure, employeur/entreprise→employeur) + une ligne `essais_gratuits` correspondante (30 jours).
**Dépendances** : T1, table `essais_gratuits` (T6).
**Vérification** : créer une organisation → une licence `essai_gratuit` et une ligne `essais_gratuits` apparaissent automatiquement, sans intervention manuelle (même mécanisme de contournement RLS par propriétaire qu'en Étape 1, cf. `DECISIONS_LOG.md`).
**Décision structurante** : essai gratuit automatique à l'inscription (self-service), pas de validation humaine préalable. Alternative écartée : licence à créer manuellement par le fondateur pour chaque organisation — non scalable pour un SaaS self-service.

### T3 — Table `abonnements`
**Objectif** : `abonnements(id uuid PK, organisation_id FK, licence_id FK -> licences, periode text check(mensuel/annuel), montant numeric not null, devise text default 'FCFA', date_debut timestamptz, date_fin timestamptz, statut text check(actif/expire/annule) default 'actif', created_by, updated_by, created_at, updated_at)`.
**Dépendances** : T1.
**Vérification** : INSERT avec `periode`/`statut` hors liste rejeté.

### T4 — Table `paiements` (append-only strict)
**Objectif** : `paiements(id uuid PK, organisation_id FK, abonnement_id FK nullable, code_promo_id FK nullable, montant numeric not null, devise text default 'FCFA', methode_paiement text, statut text check(initie/confirme/echoue/rembourse), reference_externe text, paiement_precedent_id uuid FK -> paiements nullable, created_by, created_at)`. Pas d'`updated_at` : un changement de statut (ex. webhook confirmant un paiement) insère une **nouvelle ligne** pointant vers la précédente via `paiement_precedent_id`, jamais une modification en place.
**Dépendances** : T3.
**Vérification** : une tentative UPDATE ou DELETE (même par le fondateur) est bloquée par RLS (aucune policy d'écriture après INSERT, sur le modèle de `audit_logs`) ; une requête de revenu (`sum(montant) where statut='confirme'`) reste correcte après un enchaînement initié→confirmé (2 lignes, seule la dernière au statut confirmé compte).
**Décision structurante** : append-only strict choisi pour respecter le principe absolu "tables financières = append-only" de la section 2, plutôt qu'un statut mutable en place (plus simple à interroger mais interdit explicitement par l'architecture v5).

### T5 — Table `modules_actives`
**Objectif** : `modules_actives(id uuid PK, organisation_id FK, module text not null, actif boolean default true, active_le timestamptz default now(), desactive_le timestamptz, created_by, updated_by, created_at, updated_at, unique(organisation_id, module))`.
**Dépendances** : Étape 1 (organisations).
**Vérification** : doublon (organisation_id, module) rejeté par la contrainte unique.

### T5b — Table `quotas_organisations`
**Objectif** : `quotas_organisations(id uuid PK, organisation_id uuid unique FK, max_utilisateurs int, max_beneficiaires int, max_stockage_mo int, utilisateurs_actuels int default 0, beneficiaires_actuels int default 0, stockage_utilise_mo numeric default 0, created_at, updated_at)`.
**Dépendances** : Étape 1 (organisations).
**Vérification** : unique sur `organisation_id` ; valeurs par défaut à 0 pour les compteurs.
*(Ajoutée après-coup : listée dans le document d'architecture et dans le périmètre RLS de T9, mais omise de la première passe du découpage — corrigée avant exécution.)*

### T6 — Table `essais_gratuits`
**Objectif** : `essais_gratuits(id uuid PK, organisation_id uuid unique FK, date_debut timestamptz default now(), date_fin timestamptz not null, converti boolean default false, created_at, updated_at)`.
**Dépendances** : Étape 1.
**Vérification** : unique sur `organisation_id` (un seul essai gratuit par organisation).

### T7 — Tables `wallet_fondateur` (vue) et `transactions_wallet` (append-only)
**Objectif** :
- `transactions_wallet(id uuid PK, organisation_id_source uuid FK nullable, type_mouvement text check(revenu_abonnement/commission/retrait/ajustement), montant numeric not null, devise text default 'FCFA', reference_source_table text, reference_source_id uuid, statut text check(confirme/annule) default 'confirme', created_by, created_at)`. Append-only : aucune policy UPDATE/DELETE.
- `wallet_fondateur` : **vue** `security_invoker`, `select coalesce(sum(montant) filter (where statut='confirme'), 0) as solde from transactions_wallet` — jamais une table avec un solde stocké.
**Dépendances** : aucune (indépendant des organisations, c'est le portefeuille plateforme).
**Vérification** : une tentative UPDATE/DELETE sur `transactions_wallet` est bloquée pour tout rôle ; `wallet_fondateur` reflète bien la somme après insertion de 2 lignes de test (ex. +10000, -2000 → solde = 8000).

### T8 — Table `codes_promo`
**Objectif** : `codes_promo(id uuid PK, code text unique not null, type_reduction text check(pourcentage/montant_fixe), valeur numeric not null, licences_applicables text[] default null, date_debut timestamptz, date_fin timestamptz, utilisation_max int, utilisation_actuelle int default 0, actif boolean default true, created_by, created_at, updated_at)`. Table plateforme (pas d'`organisation_id`, gérée par le fondateur uniquement en écriture).
**Dépendances** : aucune.
**Vérification** : code dupliqué rejeté par la contrainte unique ; lecture autorisée à tout authentifié (nécessaire pour valider un code à la volée), écriture réservée au fondateur.

### T9 — RLS complet + test de cloisonnement (obligatoire)
**Objectif** : RLS activée sur `licences`, `abonnements`, `paiements`, `modules_actives`, `quotas_organisations`, `essais_gratuits`, `transactions_wallet`, `codes_promo`, seed `permissions` étendu pour les nouveaux modules (`licences`, `abonnements`, `paiements`, `modules_actives`, `quotas_organisations`, `essais_gratuits`, `codes_promo`, `transactions_wallet`) pour les rôles `fondateur`/`administrateur`.
**Dépendances** : T1-T8.
**Vérification (cloisonnement, obligatoire)** : script de test sur le modèle de `supabase/tests/test_cloisonnement_etape1.sql` — 2 organisations, 2 comptes ; aucune fuite de licence/abonnement/paiement d'une organisation vers l'autre ; `transactions_wallet`/`wallet_fondateur` visibles uniquement par le fondateur ; append-only vérifié sur `paiements` et `transactions_wallet`.

### T10 — Clôture d'étape
**Objectif** : mettre à jour `ETAT_PROJET.md` et `DECISIONS_LOG.md`.
**Dépendances** : T1-T9.
**Vérification** : `ETAT_PROJET.md` reflète l'état réel vérifié (comptage tables/policies), pas une déclaration.

## Ordre d'exécution
T1 → T6 → T2 → T3 → T4 → T5 → T7 → T8 → T9 → T10

(T6 avant T2 : `essais_gratuits` doit exister avant le trigger qui y insère automatiquement une ligne.)
