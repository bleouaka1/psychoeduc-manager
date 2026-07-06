# Plan — Étape 11 : Capital social

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 13. Ne recrée pas `parents_tuteurs`/`mentors` (Étape 5).

## Décision structurante
**`capital_social` est une vue** (pas une table stockée), sur le même principe que `wallet_fondateur`/`top100_iga` : elle sélectionne la ligne la plus récente d'`evaluations_capital_social` par bénéficiaire (`DISTINCT ON`), `security_invoker`. Évite une double source de vérité entre "l'état actuel" et l'historique des évaluations — cohérent avec les décisions déjà prises cette session (pas de solde/classement dupliqué en dur).

## Tâches
### T1 — `evaluations_capital_social` + vue `capital_social`
- `evaluations_capital_social(id, beneficiaire_id FK, organisation_id FK, date_evaluation date default current_date, score_global numeric check(0-100), niveau text, evalue_par FK profiles, commentaire text, created_by, updated_by, created_at, updated_at)`.
- `capital_social` = vue `security_invoker`, `DISTINCT ON (beneficiaire_id) ... ORDER BY beneficiaire_id, date_evaluation DESC`.

### T2 — `reseau_soutien`, `personnes_ressources`, `soutiens_beneficiaires`
- `reseau_soutien(id, beneficiaire_id FK, organisation_id FK, nom text, type_lien text check(famille/ami/voisin/collegue/autre), created_by, updated_by, created_at, updated_at)`.
- `personnes_ressources(id, organisation_id FK, nom text, prenoms text, profession text, telephone text, email text, type_ressource text, created_by, updated_by, created_at, updated_at)` — annuaire partagé, pas lié à un bénéficiaire précis.
- `soutiens_beneficiaires(id, beneficiaire_id FK, organisation_id FK, personne_ressource_id FK nullable, type_soutien text, description text, date_soutien date default current_date, created_by, updated_by, created_at, updated_at)`.

### T3 — Index, triggers, seed permissions, RLS + test de cloisonnement (obligatoire)
Rôles : `fondateur`, `administrateur`, `coordinateur`, `educateur`, `assistant_social`. Vérification : 2 organisations, 0 fuite ; la vue `capital_social` retourne bien la dernière évaluation (pas une moyenne, pas la première).

### T4 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4
