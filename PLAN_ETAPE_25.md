# Plan — Étape 25 : Paramètres généraux (dernière étape du schéma v5)

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 27. `parametres_plateforme` (incluant le taux de commission) déjà construite à l'Étape 16, réutilisée telle quelle — le document demande explicitement qu'elle inclue ce taux, ce qui est déjà le cas.

## Tâches
### T1 — `parametres_modules`, `parametres_securite`, `parametres_notifications`
- `parametres_modules(id, module text unique, actif_par_defaut boolean default true, description text, created_at, updated_at)`.
- `parametres_securite(id, cle text unique, valeur jsonb, description text, updated_at)`.
- `parametres_notifications(id, cle text unique, valeur jsonb, description text, updated_at)`.
Même pattern clé/valeur que `parametres_plateforme` (Étape 16), pour la cohérence.

### T2 — RLS + test (obligatoire)
Lecture ouverte à tout authentifié (nécessaire côté client), écriture réservée au fondateur — même pattern que `parametres_plateforme`/`codes_promo`/`referentiels_iga`. Vérification : lecture par un non-fondateur autorisée, écriture par un non-fondateur bloquée.

### T3 — Clôture finale
Mise à jour `ETAT_PROJET.md` (les 25 étapes de l'architecture v5 sont closes) + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3
