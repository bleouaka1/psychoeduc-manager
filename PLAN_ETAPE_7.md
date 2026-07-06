# Plan — Étape 7 : Suivi psycho-éducatif

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 9. Données sensibles (observations comportementales, entretiens, incidents de bénéficiaires potentiellement mineurs).

## Conformité checklist
2. Cloisonnement : test T3 (2 organisations).
6. Mineurs : pas d'accès bénéficiaire direct sur ce module (même posture que l'Étape 6 — non demandé explicitement, personnel uniquement).
7. Migrations additives.

## Décision structurante
**`projets_vie` en 1:1 avec `beneficiaires`** (`beneficiaire_id unique`) : un bénéficiaire a un seul projet de vie actif à la fois. Important pour la cohérence future : l'Étape 18 (Réussites) référencera `projets_vie.statut = 'valide'` comme condition de proposition automatique de réussite — la contrainte unique garantit qu'il n'y a pas d'ambiguïté sur "le" projet de vie d'un bénéficiaire.

## Tâches
### T1 — Tables du suivi (`suivis`, `objectifs`, `observations`, `entretiens`)
- `suivis(id, beneficiaire_id FK, organisation_id FK, type_suivi text, description text, date_suivi date default current_date, statut text check(planifie/en_cours/termine) default 'planifie', responsable_id FK profiles, created_by, updated_by, created_at, updated_at)`.
- `objectifs(id, beneficiaire_id FK, organisation_id FK, suivi_id FK nullable, description text not null, date_echeance date, statut text check(en_cours/atteint/non_atteint/abandonne) default 'en_cours', created_by, updated_by, created_at, updated_at)`.
- `observations(id, beneficiaire_id FK, organisation_id FK, suivi_id FK nullable, contenu text not null, date_observation date default current_date, observe_par FK profiles, created_by, updated_by, created_at, updated_at)`.
- `entretiens(id, beneficiaire_id FK, organisation_id FK, date_entretien timestamptz, participants text, compte_rendu text, mene_par FK profiles, created_by, updated_by, created_at, updated_at)`.

### T2 — Tables disciplinaires et de synthèse (`incidents`, `sanctions`, `rapports`, `projets_vie`)
- `incidents(id, beneficiaire_id FK, organisation_id FK, type_incident text, description text not null, date_incident date default current_date, gravite text check(mineure/moderee/grave) default 'mineure', signale_par FK profiles, created_by, updated_by, created_at, updated_at)`.
- `sanctions(id, beneficiaire_id FK, organisation_id FK, incident_id FK nullable, type_sanction text, description text, date_sanction date default current_date, decidee_par FK profiles, created_by, updated_by, created_at, updated_at)`.
- `rapports(id, beneficiaire_id FK, organisation_id FK, type_rapport text, contenu text, periode_debut date, periode_fin date, redige_par FK profiles, created_by, updated_by, created_at, updated_at)`.
- `projets_vie(id, beneficiaire_id uuid unique FK, organisation_id FK, titre text, description text, statut text check(en_construction/valide/en_cours/atteint/abandonne) default 'en_construction', date_validation date, valide_par FK profiles, created_by, updated_by, created_at, updated_at)`.

### T3 — Index, triggers, seed permissions, RLS + test de cloisonnement (obligatoire)
Rôles avec accès : `fondateur`, `administrateur`, `directeur`, `coordinateur`, `educateur`, `psychologue`, `assistant_social`. Pas d'accès bénéficiaire direct. Vérification : 2 organisations, 0 fuite sur les 8 tables.

### T4 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4
