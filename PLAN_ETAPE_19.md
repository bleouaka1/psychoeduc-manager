# Plan — Étape 19 : Conformité et consentements

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 21.

## Décision structurante
**`donnee_par` modélisé en pointeur polymorphe** (`donnee_par_type` check(beneficiaire/parent_tuteur), `donnee_par_id uuid` sans FK stricte) plutôt qu'une FK unique, car la personne qui donne le consentement est soit le bénéficiaire (si majeur, `profiles.id`), soit un parent/tuteur (`parents_tuteurs.id`) — deux tables différentes. Même pattern que `affectations_personnel.cible_type/cible_id` (Étape 4).
**Révocation self-service limitée au cas bénéficiaire majeur** : `donnee_par_id = auth.uid()` permet à un bénéficiaire avec compte de révoquer lui-même son consentement. Les parents/tuteurs n'ont pas de compte de connexion dans le schéma actuel — leur révocation passe par le personnel, pas de self-service pour l'instant (non bloquant, à reconsidérer si un espace parent est construit un jour).

## Tâches
### T1 — `consentements_donnees`
`consentements_donnees(id, beneficiaire_id FK, type_consentement text check(formation/insertion/marketplace/temoignage/autre), donnee_par_type text check(beneficiaire/parent_tuteur), donnee_par_id uuid not null, date_consentement timestamptz default now(), revocable boolean default true, date_revocation timestamptz, organisation_id FK, created_by, created_at)`.

### T2 — `roles_utilisateurs.donnees_minimales_export`
`ALTER TABLE roles_utilisateurs ADD COLUMN donnees_minimales_export boolean not null default true` — migration additive pure.

### T3 — Index, seed permissions, RLS + test (obligatoire)
Vérification : un bénéficiaire avec compte peut révoquer son propre consentement (`date_revocation` mis à jour) ; il ne peut pas révoquer/lire celui d'un autre bénéficiaire ; cloisonnement (2 organisations) ; la colonne `donnees_minimales_export` existe avec la valeur par défaut attendue.

### T4 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4
