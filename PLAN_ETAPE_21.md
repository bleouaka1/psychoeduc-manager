# Plan — Étape 21 : Centre IA

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 23. Règle de sécurité explicite : `consommations_ia` doit vérifier `quotas_organisations` avant de permettre un appel IA, pour éviter qu'un compte gratuit ne génère une facture d'API incontrôlée.

## Décision structurante
**Quota IA appliqué par un vrai garde-fou base de données**, pas seulement une vérification côté application (qui pourrait être contournée ou buguée). Ajout additif sur `quotas_organisations` (Étape 2) : `quota_ia_tokens_mensuel int default 100000` (`null` = illimité), `ia_tokens_consommes_mois_courant int not null default 0`. Un trigger `BEFORE INSERT` sur `consommations_ia` rejette l'insertion si le quota serait dépassé, et incrémente le compteur sinon — le dépassement de quota est donc physiquement impossible à insérer en base, pas seulement déconseillé côté application.

## Tâches
### T1 — Ajout additif sur `quotas_organisations`
`ALTER TABLE quotas_organisations ADD COLUMN quota_ia_tokens_mensuel int DEFAULT 100000, ADD COLUMN ia_tokens_consommes_mois_courant int NOT NULL DEFAULT 0`.

### T2 — `agents_ia`, `sessions_ia`, `rapports_ia`, `recommandations_ia`
- `agents_ia(id, organisation_id FK nullable, nom text not null, type_agent text, description text, actif boolean default true, created_by, updated_by, created_at, updated_at)`.
- `sessions_ia(id, agent_id FK, profile_id FK, organisation_id FK, titre text, contexte jsonb, created_at, updated_at)`.
- `rapports_ia(id, session_id FK, organisation_id FK, contenu text, type_rapport text, created_at, updated_at)`.
- `recommandations_ia(id, session_id FK nullable, beneficiaire_id FK nullable, organisation_id FK, contenu text not null, type_recommandation text, statut text check(proposee/acceptee/rejetee) default 'proposee', created_at, updated_at)`.

### T3 — `consommations_ia` (append-only) + garde-fou de quota
`consommations_ia(id, organisation_id FK, profile_id FK, agent_id FK nullable, session_id FK nullable, nb_tokens int not null, cout_estime numeric, created_at)`. Trigger `BEFORE INSERT` : vérifie `quotas_organisations.quota_ia_tokens_mensuel`, rejette si dépassement, incrémente `ia_tokens_consommes_mois_courant` sinon.

### T4 — Index, seed permissions, RLS + test (obligatoire)
Vérification : une insertion dans `consommations_ia` qui dépasserait le quota est bloquée ; une insertion dans les limites incrémente correctement le compteur ; cloisonnement (2 organisations).

### T5 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4→T5
