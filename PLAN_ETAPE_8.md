# Plan — Étape 8 : Formations & Classes

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 10. Réutilise `classes_groupes` de l'Étape 6, ne la recrée pas.

## Conformité checklist
2. Cloisonnement : test T4.
7. Migrations additives.

## Décisions structurantes
1. **`competences` organisation-scopée**, pas un référentiel global — chaque organisation définit ses propres compétences pour l'instant (pas de mention explicite d'un référentiel partagé dans le document pour cette étape ; `referentiel_metiers_formations` global existe séparément à l'Étape 12).
2. **Pas d'accès bénéficiaire direct** sur ce module (résultats de quiz, soumissions de devoirs compris) — même posture que les Étapes 6 et 7, faute d'écran de connexion bénéficiaire fonctionnel à tester. Noté comme extension naturelle future (portail d'apprentissage self-service) une fois l'authentification construite.

## Tâches
### T1 — `formations`, `cours`, `ressources_cours`
- `formations(id, organisation_id FK, titre text not null, description text, niveau text, duree_heures int, statut text check(brouillon/publiee/archivee) default 'brouillon', created_by, updated_by, created_at, updated_at)`.
- `cours(id, formation_id FK, organisation_id FK, titre text not null, description text, ordre int, duree_minutes int, created_by, updated_by, created_at, updated_at)`.
- `ressources_cours(id, cours_id FK, organisation_id FK, type_ressource text check(video/audio/document/lien), titre text, url_fichier text, created_by, updated_by, created_at, updated_at)`.

### T2 — `competences`, `preuves_competences`
- `competences(id, organisation_id FK, code text, nom text not null, description text, niveau_requis text, created_by, updated_by, created_at, updated_at)`.
- `preuves_competences(id, beneficiaire_id FK, competence_id FK, organisation_id FK, description text, url_fichier text, date_obtention date default current_date, valide boolean default false, valide_par FK profiles, created_by, updated_by, created_at, updated_at)`.

### T3 — `quiz`, `questions_quiz`, `resultats_quiz`, `devoirs`, `soumissions_devoirs`
- `quiz(id, cours_id FK, organisation_id FK, titre text not null, description text, note_maximale numeric default 20, created_by, updated_by, created_at, updated_at)`.
- `questions_quiz(id, quiz_id FK, organisation_id FK, enonce text not null, type_question text check(choix_unique/choix_multiple/texte_libre) default 'choix_unique', points numeric default 1, ordre int, created_at, updated_at)`.
- `resultats_quiz(id, quiz_id FK, beneficiaire_id FK, organisation_id FK, score numeric, date_passage timestamptz default now(), reponses jsonb, created_at, updated_at)`.
- `devoirs(id, cours_id FK, organisation_id FK, titre text not null, description text, date_limite date, created_by, updated_by, created_at, updated_at)`.
- `soumissions_devoirs(id, devoir_id FK, beneficiaire_id FK, organisation_id FK, contenu text, url_fichier text, date_soumission timestamptz default now(), note numeric, evalue_par FK profiles, created_at, updated_at)`.

### T4 — Index, triggers, seed permissions, RLS + test de cloisonnement (obligatoire)
Rôles : `fondateur`, `administrateur`, `coordinateur`, `educateur`, `formateur`, `enseignant`. Vérification : 2 organisations, 0 fuite sur les 10 tables.

### T5 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4→T5
