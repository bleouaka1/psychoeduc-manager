# Plan — Étape 18 : Réussites

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 20. **La vraie Étape 18** (à ne pas confondre avec "Étape 18 light" construite plus tôt cette session, qui était en réalité un aperçu anticipé de l'Étape 23 — voir la correction de numérotation dans `DECISIONS_LOG.md`).

## Décision structurante
**Proposition automatique implémentée par trigger sur `suivis_post_insertion`**, malgré le principe absolu "logique métier critique en TypeScript, pas en fonctions Postgres imbriquées" (section 2). Justification : la règle ("projet de vie validé ET maintien ≥ 3 mois") est une simple vérification de deux conditions déjà présentes en base au moment de l'insertion d'un suivi, pas un calcul complexe (contrairement aux scores IGA) — comparable en complexité au trigger de masquage automatique de l'Étape 16, déjà accepté. La proposition reste `proposee_systeme`, invisible des statistiques officielles tant qu'un humain ne confirme pas — le trigger ne fait que proposer, jamais confirmer, ce qui respecte l'esprit du principe (pas de décision automatique irréversible).

## Tâches
### T1 — `reussites_beneficiaires`
`reussites_beneficiaires(id, beneficiaire_id FK, projet_vie_id FK, insertion_id FK, statut text check(proposee_systeme/confirmee/rejetee) default 'proposee_systeme', score_iga_au_moment numeric, duree_insertion_mois int, projet_vie_valide boolean, confirmee_par FK profiles, date_confirmation timestamptz, temoignage text, organisation_id FK, created_by, created_at)`.

### T2 — Trigger de proposition automatique
`AFTER INSERT OR UPDATE ON suivis_post_insertion` : si `projets_vie.statut='valide'` pour le bénéficiaire concerné ET `statut_maintien='maintenu'` ET la durée depuis `insertions_professionnelles.date_debut` ≥ 3 mois (~90 jours) ET aucune réussite déjà proposée pour cette insertion → insère une ligne `proposee_systeme`, avec le dernier score IGA connu du bénéficiaire au moment de la proposition.

### T3 — Index, seed permissions, RLS + test (obligatoire)
Confirmation/rejet réservés aux rôles habilités (`fondateur`, `educateur`, `coach`, `coordinateur`). Vérification : un suivi "maintenu" à J+95 avec projet de vie validé déclenche bien la proposition automatique ; un suivi à J+30 (trop tôt) ne déclenche rien ; un suivi sans projet de vie validé ne déclenche rien ; cloisonnement (2 organisations).

### T4 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4
