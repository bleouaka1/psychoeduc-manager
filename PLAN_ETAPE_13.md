# Plan — Étape 13 : Intelligence économique

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 15. Le document ne mentionne pas de lien direct vers `beneficiaire_id` pour ces tables — ce sont des ressources d'information (opportunités, concours, bourses, financements, métiers porteurs, analyses de marché), pas des dossiers individuels.

## Décision structurante
**`organisation_id` nullable sur les 6 tables** : `null` = ressource globale curatée par le fondateur, visible à tous (même pattern que `codes_promo`/`referentiels_iga`) ; une valeur = ressource spécifique à une organisation (ex. une structure qui relaie une opportunité locale à ses propres bénéficiaires). Alternative écartée : tout organisation-scopé strict — aurait empêché le fondateur de publier des ressources globales utiles à toute la plateforme.

## Tâches
### T1 — `opportunites`, `concours`, `bourses`
- `opportunites(id, organisation_id FK nullable, titre text not null, description text, type_opportunite text, secteur text, date_publication date default current_date, date_expiration date, url_lien text, created_by, updated_by, created_at, updated_at)`.
- `concours(id, organisation_id FK nullable, titre text not null, description text, organisateur text, date_limite_inscription date, url_lien text, created_by, updated_by, created_at, updated_at)`.
- `bourses(id, organisation_id FK nullable, titre text not null, description text, organisme text, montant text, date_limite date, url_lien text, created_by, updated_by, created_at, updated_at)`.

### T2 — `financements`, `metiers_porteurs`, `analyses_marche`
- `financements(id, organisation_id FK nullable, titre text not null, description text, organisme text, montant_max numeric, conditions text, url_lien text, created_by, updated_by, created_at, updated_at)`.
- `metiers_porteurs(id, organisation_id FK nullable, nom_metier text not null, secteur text, description text, niveau_demande text check(faible/moyen/eleve), created_by, updated_by, created_at, updated_at)`.
- `analyses_marche(id, organisation_id FK nullable, titre text not null, contenu text, secteur text, date_publication date default current_date, redige_par FK profiles, created_by, updated_by, created_at, updated_at)`.

### T3 — Index, triggers, seed permissions, RLS + test (obligatoire)
Lecture : `is_fondateur() OR organisation_id IS NULL (global) OR peut_lire(module, organisation_id)`. Écriture globale (organisation_id null) réservée au fondateur ; écriture organisation-scopée via `peut_creer`. Vérification : une ressource globale est visible par tous ; une ressource org-scopée d'une organisation A n'est jamais visible par un compte de l'organisation B.

### T4 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4
