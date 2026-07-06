# Plan — Étape 12 : Insertion professionnelle

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 14.

## Décision structurante
**`suivis_post_insertion` doit porter assez d'information pour permettre à l'Étape 18 (Réussites) de calculer "maintien en poste ≥ 3 mois"** sans ambiguïté : chaque ligne porte `date_suivi` et `statut_maintien`, et `insertions_professionnelles` porte `date_debut`. La durée de maintien se calcule par différence de dates au moment voulu (pas stockée en dur), cohérent avec le principe "l'âge ne se stocke jamais" appliqué par analogie à toute durée calculable.

## Tâches
### T1 — `entreprises_partenaires`, `offres_emploi`, `offres_stage`
- `entreprises_partenaires(id, organisation_id FK, nom text not null, secteur text, contact_nom text, contact_telephone text, contact_email text, created_by, updated_by, created_at, updated_at)`.
- `offres_emploi(id, organisation_id FK, entreprise_partenaire_id FK nullable, titre text not null, description text, type_contrat text check(cdi/cdd/interim/freelance), lieu text, salaire_propose text, date_publication date default current_date, date_expiration date, statut text check(ouverte/fermee/pourvue) default 'ouverte', created_by, updated_by, created_at, updated_at)`.
- `offres_stage(id, organisation_id FK, entreprise_partenaire_id FK nullable, titre text not null, description text, duree_semaines int, lieu text, remuneree boolean default false, date_publication date default current_date, date_expiration date, statut text check(ouverte/fermee/pourvue) default 'ouverte', created_by, updated_by, created_at, updated_at)`.

### T2 — `demandes_stage`, `candidatures`, `recrutements`
- `demandes_stage(id, beneficiaire_id FK, organisation_id FK, offre_stage_id FK, date_demande date default current_date, statut text check(en_attente/acceptee/refusee) default 'en_attente', created_by, updated_by, created_at, updated_at)`.
- `candidatures(id, beneficiaire_id FK, organisation_id FK, offre_emploi_id FK, date_candidature date default current_date, statut text check(soumise/en_cours/acceptee/refusee) default 'soumise', cv_url text, lettre_motivation text, created_by, updated_by, created_at, updated_at)`.
- `recrutements(id, candidature_id FK, organisation_id FK, entreprise_partenaire_id FK nullable, date_recrutement date default current_date, poste text, salaire numeric, created_by, updated_by, created_at, updated_at)`.

### T3 — `insertions_professionnelles`, `stages`, `suivis_post_insertion`, `evaluations_insertion`
- `insertions_professionnelles(id, beneficiaire_id FK, organisation_id FK, recrutement_id FK nullable, type_insertion text check(emploi/stage/auto_emploi), date_debut date default current_date, date_fin date, statut text check(en_cours/terminee/rompue) default 'en_cours', created_by, updated_by, created_at, updated_at)`.
- `stages(id, beneficiaire_id FK, organisation_id FK, offre_stage_id FK nullable, date_debut date default current_date, date_fin date, statut text check(en_cours/termine/rompu) default 'en_cours', evaluation_finale text, created_by, updated_by, created_at, updated_at)`.
- `suivis_post_insertion(id, insertion_id FK -> insertions_professionnelles, organisation_id FK, date_suivi date default current_date, statut_maintien text check(maintenu/rompu), commentaire text, suivi_par FK profiles, created_by, updated_by, created_at, updated_at)`.
- `evaluations_insertion(id, insertion_id FK, organisation_id FK, date_evaluation date default current_date, satisfaction_beneficiaire text, satisfaction_employeur text, commentaire text, evalue_par FK profiles, created_by, updated_by, created_at, updated_at)`.

### T4 — Index, triggers, seed permissions, RLS + test de cloisonnement (obligatoire)
Rôles : `fondateur`, `administrateur`, `coordinateur`, `educateur`, `assistant_social`, `employeur`, `recruteur`. Vérification : 2 organisations, 0 fuite sur les 10 tables.

### T5 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4→T5
