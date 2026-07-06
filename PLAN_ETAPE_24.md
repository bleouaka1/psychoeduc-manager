# Plan — Étape 24 : Sauvegardes & export hors-ligne

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 26.

## Décision structurante
**`chiffree` verrouillée à `true` par un CHECK constraint** (`chiffree boolean not null default true check (chiffree = true)`), pas seulement une valeur par défaut — rend physiquement impossible d'enregistrer une sauvegarde non chiffrée, conformément à la règle absolue du document ("chiffrée, toujours true").
**Pas d'automatisation nocturne réelle construite ce soir** : la planification effective (pg_cron + Edge Function, ou scheduler externe) est une tâche d'infrastructure/ops, hors du périmètre d'une migration de schéma. Le schéma est prêt à recevoir des lignes créées par cette automatisation une fois mise en place — noté comme reste à faire, pas un blocage.

## Tâches
### T1 — `sauvegardes_export`
`sauvegardes_export(id, type_export text check(complet/partiel), format text check(sql/csv/json), taille_mo numeric, declenchee_par text check(systeme/fondateur), chiffree boolean not null default true check(chiffree=true), date_creation timestamptz default now(), url_stockage_temporaire text, expire_le timestamptz, statut text check(en_cours/prete/expiree) default 'en_cours', created_by FK profiles)`.

### T2 — RLS + test (obligatoire)
Accès exclusivement fondateur (lecture et écriture), conformément à la règle explicite du document. Chaque accès/téléchargement doit rester traçable via `audit_logs` (trigger générique déjà en place, réutilisé). Vérification : un non-fondateur n'a aucun accès (0 ligne, insertion refusée) ; une tentative d'insérer `chiffree=false` est rejetée par le CHECK.

### T3 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3
