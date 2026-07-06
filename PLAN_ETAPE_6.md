# Plan — Étape 6 : Présences & Assiduité

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 8.

## Conformité checklist
2. Cloisonnement : test T7 (2 organisations).
6. Mineurs : présences liées à des bénéficiaires potentiellement mineurs — accès personnel uniquement, aucun accès direct bénéficiaire à ce stade (pas demandé par le document pour ce module).
7. Migrations additives.

## Décisions structurantes
1. **`presences`/`absences`/`retards` en 3 tables distinctes** (au lieu d'une seule table avec statut), conformément à la liste explicite du document. `presences` est le registre quotidien (une ligne par bénéficiaire par séance) ; `absences`/`retards` sont des enregistrements de détail liés à une ligne `presences` donnée (motif, durée, justification) — pas une duplication mais un niveau de détail supplémentaire.
2. **`affectations_personnel.cible_type = 'classe'`** peut désormais référencer `classes_groupes.id` (pointeur polymorphe posé à l'Étape 4) — aucune modification de schéma nécessaire, juste une note de raccordement.

## Tâches
### T1 — `classes_groupes`
`classes_groupes(id, organisation_id FK, nom text not null, niveau text, effectif_max int, annee_scolaire text, responsable_membre_organisation_id FK -> membres_organisations nullable, created_by, updated_by, created_at, updated_at)`.

### T2 — `inscriptions_classes`
`inscriptions_classes(id, classe_id FK, beneficiaire_id FK, organisation_id FK, date_inscription date default current_date, statut text check(active/terminee/transferee) default 'active', created_by, updated_by, created_at, updated_at)`, unique(classe_id, beneficiaire_id).

### T3 — `presences`
`presences(id, classe_id FK, beneficiaire_id FK, organisation_id FK, date_seance date not null, statut text check(present/absent/retard) not null default 'present', heure_arrivee time, created_by, updated_by, created_at, updated_at)`, unique(classe_id, beneficiaire_id, date_seance).

### T4 — `absences`, `retards`, `justifications_absence`
- `absences(id, presence_id FK, beneficiaire_id FK, organisation_id FK, motif text, justifiee boolean default false, created_by, updated_by, created_at, updated_at)`.
- `retards(id, presence_id FK, beneficiaire_id FK, organisation_id FK, duree_minutes int, motif text, created_by, updated_by, created_at, updated_at)`.
- `justifications_absence(id, absence_id FK, document_url text, motif text, soumis_par FK profiles, statut text check(en_attente/acceptee/refusee) default 'en_attente', traite_par FK profiles, created_at, updated_at)`.

### T5 — `alertes_assiduite`
`alertes_assiduite(id, beneficiaire_id FK, organisation_id FK, type_alerte text check(absences_repetees/retards_frequents/absence_prolongee), seuil_declenche text, statut text check(active/traitee/ignoree) default 'active', traite_par FK profiles, traite_le timestamptz, created_at, updated_at)`.

### T6 — Index, triggers, seed permissions, RLS + test de cloisonnement (obligatoire)
Rôles avec accès : `fondateur`, `administrateur`, `directeur`, `coordinateur`, `educateur`, `formateur`. Pas d'accès direct bénéficiaire (non demandé ici). Vérification : 2 organisations, 0 fuite.

### T7 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4→T5→T6→T7
