# Plan — Étape 10 : AGR (Activités Génératrices de Revenus)

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 12. AGR est séparé de l'IGA (dimension distincte, table distincte).

## Décision structurante
**`revenus_agr`/`charges_agr` en append-only strict**, comme les tables financières de l'Étape 2 : ce sont des mouvements d'argent (revenus/charges d'une activité économique d'un bénéficiaire), le principe absolu de la section 2 s'applique. Toute correction crée une nouvelle ligne, jamais une modification en place. `activites_agr`/`evaluations_agr`/`rapports_agr` restent mutables normalement (pas des registres financiers en tant que tels).

## Tâches
### T1 — `activites_agr`
`activites_agr(id, beneficiaire_id FK, organisation_id FK, nom_activite text not null, description text, secteur text, date_debut date default current_date, date_fin date, statut text check(en_cours/suspendue/terminee) default 'en_cours', created_by, updated_by, created_at, updated_at)`.

### T2 — `revenus_agr`, `charges_agr` (append-only)
- `revenus_agr(id, activite_agr_id FK, organisation_id FK, montant numeric not null, devise text default 'FCFA', periode date, source text, created_by, created_at)`.
- `charges_agr(id, activite_agr_id FK, organisation_id FK, montant numeric not null, devise text default 'FCFA', periode date, categorie text, created_by, created_at)`.
Aucune policy UPDATE/DELETE sur les deux.

### T3 — `evaluations_agr`, `rapports_agr`
- `evaluations_agr(id, activite_agr_id FK, organisation_id FK, date_evaluation date default current_date, rentabilite text check(faible/moyenne/bonne/excellente), commentaire text, evalue_par FK profiles, created_by, updated_by, created_at, updated_at)`.
- `rapports_agr(id, activite_agr_id FK, organisation_id FK, contenu text, periode_debut date, periode_fin date, redige_par FK profiles, created_by, updated_by, created_at, updated_at)`.

### T4 — Index, triggers, seed permissions, RLS + test de cloisonnement (obligatoire, incluant append-only)
Rôles : `fondateur`, `administrateur`, `coordinateur`, `educateur`, `assistant_social`. Vérification : 2 organisations, 0 fuite ; UPDATE/DELETE sur `revenus_agr`/`charges_agr` bloqués même pour le fondateur.

### T5 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4→T5
