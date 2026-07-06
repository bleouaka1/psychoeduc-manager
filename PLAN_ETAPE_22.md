# Plan — Étape 22 : Support

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 24.

## Décision structurante
**`faq`/`tutoriels` sans `organisation_id`** : contenu de support entièrement global, curaté par le fondateur, identique pour toutes les organisations (pas de personnalisation par structure demandée par le document).

## Tâches
### T1 — `tickets_support`, `reponses_support`
- `tickets_support(id, organisation_id FK nullable, profile_id FK, sujet text not null, description text, categorie text, priorite text check(basse/normale/haute/urgente) default 'normale', statut text check(ouvert/en_cours/resolu/ferme) default 'ouvert', created_at, updated_at)`.
- `reponses_support(id, ticket_id FK, profile_id FK, contenu text not null, created_at)`.

### T2 — `faq`, `tutoriels`
- `faq(id, question text not null, reponse text, categorie text, ordre int, actif boolean default true, created_at, updated_at)`.
- `tutoriels(id, titre text not null, contenu text, type_contenu text check(video/document/lien), url_ressource text, categorie text, ordre int, actif boolean default true, created_at, updated_at)`.

### T3 — Index, seed permissions, RLS + test (obligatoire)
`tickets_support`/`reponses_support` : un utilisateur voit ses propres tickets, le personnel de son organisation voit ceux de l'organisation, le fondateur voit tout. `faq`/`tutoriels` : lecture ouverte à tout authentifié, écriture fondateur uniquement. Vérification : cloisonnement (2 organisations/2 utilisateurs), FAQ visible par tous.

### T4 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4
