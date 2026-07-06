# Plan — Étape 5 : Bénéficiaires

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 7. **Données sensibles (potentiellement des mineurs) : checklist sécurité complète obligatoire, pas seulement le cloisonnement standard.**

## Conformité checklist de durabilité
2. Cloisonnement multi-organisations : test automatisé obligatoire (T7), pas une vérification ponctuelle.
6. Conformité mineurs : `consentements_donnees` (Étape 19) n'existe pas encore. En attendant, principe du minimum d'exposition appliqué par défaut : RLS stricte dès la création (jamais après), aucune fonctionnalité de partage public/lien non authentifié introduite (aucune n'est demandée), un bénéficiaire lui-même ne voit que sa propre fiche (pas celles des autres bénéficiaires de l'organisation).
7. Migrations additives uniquement.
1, 3, 4 : sans objet direct ici (pas d'IGA calculé ici, logique métier minimale, pas d'argent).

## Décisions structurantes à prendre
1. **Pas de colonnes `score_iga_actuel`/`capital_social`/`statut_insertion` directement sur `beneficiaires`**, malgré leur mention dans le document comme "champs" de la fiche bénéficiaire. Ces valeurs auront leurs propres tables dédiées et versionnées (`scores_iga` à l'Étape 9, `capital_social` à l'Étape 11, `insertions_sociopro` à l'Étape 12). Les dupliquer maintenant comme colonnes mutables sur `beneficiaires` créerait deux sources de vérité divergentes. Elles seront exposées via une vue de synthèse une fois ces tables construites (Étape 18 light / Étape 23).
2. **L'âge n'est jamais stocké** (principe absolu section 2) : pas de colonne `age`, même générée. Une fonction `public.calculer_age(date_naissance date)` est fournie pour le calcul à la demande partout où nécessaire.
3. **`beneficiaires.profile_id` nullable** : la plupart des bénéficiaires (en particulier les mineurs) n'ont pas de compte de connexion. Un lien optionnel vers `profiles` couvre le cas où un bénéficiaire a effectivement son propre accès (rôle `beneficiaire`).
4. **`handicap` en `boolean` + `handicap_details` en texte libre séparé**, plutôt qu'un seul champ texte — permet un filtre simple sans obliger à parser du texte libre.
5. **Un bénéficiaire connecté (`profile_id = auth.uid()`) voit uniquement sa propre fiche**, jamais les autres bénéficiaires de son organisation — RLS spécifique en plus du scoping par organisation habituel, condition non-négociable pour cette table (données de mineurs).

## Tâches

### T1 — `beneficiaires`
**Objectif** : `beneficiaires(id uuid PK, organisation_id FK not null, profile_id uuid FK nullable references profiles, nom text not null, prenoms text not null, sexe text check(masculin/feminin/non_renseigne) default 'non_renseigne', date_naissance date, photo_url text, telephone text, email text, adresse text, pays text, ville text, situation_familiale text, sante text, handicap boolean default false, handicap_details text, niveau_etude text, formation_actuelle text, statut_beneficiaire text check(actif/inactif/suspendu/sorti) default 'actif', created_by, updated_by, created_at, updated_at)`.
**Vérification** : CHECK rejette un `sexe`/`statut_beneficiaire` hors liste ; pas de colonne d'âge dans le schéma (vérifié par `\d beneficiaires`).

### T2 — fonction `calculer_age`
**Objectif** : `public.calculer_age(p_date_naissance date) returns int` = `date_part('year', age(current_date, p_date_naissance))`.
**Vérification** : appelée avec une date de test, retourne l'âge attendu.

### T3 — `parents_tuteurs`
**Objectif** : `parents_tuteurs(id uuid PK, beneficiaire_id FK, organisation_id FK, nom text, prenoms text, lien_parente text check(pere/mere/tuteur_legal/autre), telephone text, email text, adresse text, est_contact_urgence boolean default false, created_by, updated_by, created_at, updated_at)`.
**Vérification** : CHECK rejette un `lien_parente` hors liste.

### T4 — `mentors`
**Objectif** : `mentors(id uuid PK, beneficiaire_id FK, organisation_id FK, nom text, prenoms text, telephone text, email text, profession text, structure_origine text, date_debut date default current_date, date_fin date, statut text check(actif/inactif) default 'actif', created_by, updated_by, created_at, updated_at)`.
**Vérification** : CHECK rejette un statut hors liste.

### T5 — `documents_beneficiaires`
**Objectif** : `documents_beneficiaires(id uuid PK, beneficiaire_id FK, organisation_id FK, type_document text, nom_fichier text, url_fichier text, taille_ko int, televerse_par uuid FK profiles, created_at, updated_at)`. Aucune fonctionnalité de lien public/non authentifié — accès exclusivement via RLS + rôle autorisé.
**Vérification** : RLS empêche tout accès sans authentification (testé par une requête sans JWT valide → 0 ligne).

### T6 — `dossiers_beneficiaires`
**Objectif** : `dossiers_beneficiaires(id uuid PK, beneficiaire_id uuid unique FK, organisation_id FK, resume_situation text, objectifs_generaux text, statut_dossier text check(ouvert/en_cours/cloture) default 'ouvert', date_ouverture date default current_date, date_cloture date, cloture_par uuid FK profiles, created_by, updated_by, created_at, updated_at)`.
**Vérification** : unique sur `beneficiaire_id` (un seul dossier de synthèse par bénéficiaire).

### T7 — RLS complet + checklist sécurité + test de cloisonnement (obligatoire, renforcé)
**Objectif** : RLS sur les 5 tables. Pour `beneficiaires` : lecture = membres de l'organisation avec `peut_lire('beneficiaires', org)` OU le bénéficiaire lui-même (`profile_id = auth.uid()`, restreint à SA PROPRE ligne, jamais aux autres). Pour les tables liées (`parents_tuteurs`, `mentors`, `documents_beneficiaires`, `dossiers_beneficiaires`) : scoping direct par `organisation_id`, pas d'accès bénéficiaire direct à ce stade (ces tables sont côté professionnel).
Seed `permissions` pour les rôles pertinents : `fondateur` (tout), `administrateur`/`directeur`/`coordinateur`/`educateur`/`formateur`/`psychologue`/`assistant_social` (lire/créer/modifier selon rôle), `beneficiaire` (lecture de sa propre fiche uniquement, pas des tables liées).
**Dépendances** : T1-T6.
**Vérification (cloisonnement + sécurité, obligatoire)** :
- 2 organisations, 2 comptes staff : 0 fuite de bénéficiaires/dossiers/documents/parents/mentors entre elles.
- Un compte avec rôle `beneficiaire` lié à un `profile_id` : voit sa propre fiche `beneficiaires`, ne voit PAS les autres bénéficiaires de la même organisation (test explicite, pas supposé).
- Aucun accès à `documents_beneficiaires`/`dossiers_beneficiaires` sans authentification.

### T8 — Clôture d'étape
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`. Rappel explicite dans `ETAT_PROJET.md` : la conformité mineurs complète (consentements) arrive à l'Étape 19 — l'exposition actuelle est déjà minimisée par défaut (RLS stricte, pas de partage public) mais n'est pas le dispositif final.

## Ordre d'exécution
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8
