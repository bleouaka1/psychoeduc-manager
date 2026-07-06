# Plan — Étape 4 : Utilisateurs & Personnel

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 6.

## Conformité checklist
2. Cloisonnement : couvert par T5 (test 2 organisations).
7. Migrations additives uniquement.
Autres principes : sans objet direct ici.

## Décisions structurantes à prendre
1. **`personnel_structures` en complément 1:1 de `membres_organisations`**, pas une table de comptes séparée : elle ajoute le détail RH (poste, date d'embauche) pour les membres qui sont aussi du personnel, réutilisant `membre_organisation_id` plutôt que dupliquer `organisation_id`/`profile_id`.
2. **`affectations_personnel` avec pointeur polymorphe (`cible_type`, `cible_id`)** plutôt qu'une FK stricte : les cibles naturelles d'une affectation (classes, bénéficiaires, programmes) n'existent pas encore (étapes 5-8, à venir). Alternative écartée : reporter cette table à une étape ultérieure — rejetée car le document l'assigne explicitement à l'Étape 4. Le pointeur polymorphe est délibérément minimal (2 colonnes), pas une architecture EAV complète.
3. **`sessions_connexion` scopée par organisation** (`organisation_id` nullable) en plus du profil : reprend le pattern déjà présent dans l'ancien schéma (avant reset) où les sessions étaient rattachées à une organisation pour l'audit de sécurité par structure, pas seulement par utilisateur global.

## Tâches

### T1 — `personnel_structures`
**Objectif** : `personnel_structures(id uuid PK, membre_organisation_id uuid unique FK -> membres_organisations, poste text, date_embauche date, statut text check(actif/inactif/suspendu) default 'actif', created_by, updated_by, created_at, updated_at)`.
**Vérification** : unique sur `membre_organisation_id` (une seule fiche RH par membre).

### T2 — `invitations_utilisateurs`
**Objectif** : `invitations_utilisateurs(id uuid PK, organisation_id FK, email text not null, role_propose text check(enum des 19 rôles), statut text check(en_attente/acceptee/refusee/expiree) default 'en_attente', token text unique not null default encode(gen_random_bytes(32),'hex'), invite_par uuid FK profiles, expire_le timestamptz default now()+interval '7 days', created_at, updated_at)`.
**Vérification** : token généré automatiquement et unique ; `role_propose` hors liste rejeté.

### T3 — `affectations_personnel`
**Objectif** : `affectations_personnel(id uuid PK, organisation_id FK, membre_organisation_id FK -> membres_organisations, cible_type text, cible_id uuid, fonction text, date_debut date default current_date, date_fin date, statut text check(active/terminee) default 'active', created_by, updated_by, created_at, updated_at)`.
**Vérification** : insertion valide avec `cible_type`/`cible_id` arbitraires (pas de FK stricte, assumé et documenté).

### T4 — `sessions_connexion`
**Objectif** : `sessions_connexion(id uuid PK, organisation_id FK nullable, profile_id FK -> profiles, ip_adresse inet, user_agent text, connecte_le timestamptz default now(), deconnecte_le timestamptz, created_by, updated_by, created_at, updated_at)`.
**Vérification** : un utilisateur voit ses propres sessions ; RLS testée.

### T5 — RLS, index, triggers, seed permissions + test de cloisonnement (obligatoire)
**Objectif** : RLS sur les 4 tables (lecture membres/fondateur sauf `sessions_connexion` = soi-même + fondateur/admin ; écriture via `peut_creer/modifier/supprimer` ou fondateur), index FK, triggers `updated_at`+audit (sauf `sessions_connexion`, pas d'audit générique dessus — l'audit d'une connexion n'a pas de sens de "avant/après").
**Dépendances** : T1-T4.
**Vérification (cloisonnement obligatoire)** : 2 organisations, 0 fuite de personnel/invitations/affectations/sessions entre elles.

### T6 — Clôture d'étape
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre d'exécution
T1 → T2 → T3 → T4 → T5 → T6
