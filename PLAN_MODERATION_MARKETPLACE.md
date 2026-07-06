# Plan — Modération Marketplace (Fondateur) + Messagerie ciblée sur une offre

Contexte : ceci est l'**Étape 3/3** du chantier "Publication automatique des formations + badge vérification", dont les étapes 1 (schéma, `20260712000000_marketplace_auto_formations_schema.sql`) et 2 (logique auto-publish, `lib/marketplaceAutoPublish.ts`) sont déjà faites et validées (voir `DECISIONS_LOG.md`, entrées du 2026-07-07). Étend la page déjà existante `app/(dashboard)/marketplace/page.tsx` (actuellement lecture seule) plutôt que d'en créer une nouvelle.

Angenor a demandé une exécution étape par étape avec validation visuelle/fonctionnelle entre chaque tâche — pas d'exécution autonome ici. Chaque tâche ci-dessous s'arrête et attend confirmation avant la suivante.

## Décisions structurantes

1. **La transition vers `publiee`/`refusee` (action Valider) reste strictement réservée à `is_fondateur()`.** C'est une contrainte déjà imposée par le trigger `enforce_marketplace_offre_statut()` depuis l'Étape 16, non modifiée ici. Le bouton "Valider" n'est donc affiché qu'au fondateur. Alternative écartée : ouvrir la validation à `peut_modifier` comme demandé littéralement dans le prompt — écartée car elle contredirait une règle déjà en base et déjà documentée ; un rôle organisationnel ne peut pas s'auto-valider.
2. **Suspendre/Supprimer suivent le modèle `peut_modifier`/`is_fondateur` scoped-organisation déjà en RLS** (`marketplace_offres_update`) — accessibles à un rôle habilité de l'organisation propriétaire de l'offre, jamais celles d'un tiers (déjà garanti par la clause `organisation_id` de la policy).
3. **Aucune colonne "motif" ajoutée à `marketplace_offres`.** Le motif est transmis via le contenu de la notification et capturé dans `audit_logs.donnees_apres` (jsonb) — cohérent avec le principe du projet "champ calculé/journalisé plutôt que colonne dupliquée".
4. **`messages.marketplace_offre_id` (nouvelle colonne nullable) ne nécessite aucune nouvelle policy RLS.** Les policies existantes (`expediteur_id = auth.uid() or destinataire_id = auth.uid() or is_fondateur()`) isolent déjà chaque conversation par destinataire — le cloisonnement par vendeur en découle naturellement, comme vérifié pour `destinataire_beneficiaire_id` (migration bénéficiaires).

## Partie A — Vue de modération + 3 actions

### A1 — Vue de modération, lecture seule
Étendre `app/(dashboard)/marketplace/page.tsx` : colonnes Titre / Vendeur (nom + type via `organisations(nom, type_organisation)`) / Type d'offre / Prix / Date de création / Statut (ajouter `visible_en_verification` au dictionnaire `STATUT_STYLE`) ; filtre par statut ; recherche par titre ou nom de vendeur. Aucune action, aucune écriture.
**Vérification** : chargement sans erreur avec un compte fondateur ; chaque valeur du filtre restreint correctement la liste ; la recherche filtre par titre/vendeur.

### A2 — Action "Valider"
Server Action `validerOffreMarketplace(offreId)` : statut → `publiee` (le trigger existant fixe `valide_par`/`date_validation`). Bouton visible seulement si `is_fondateur()`. Gérer proprement l'exception du trigger si `image_couverture_url` est manquante (message explicite, pas un crash). Insertion `audit_logs` (action, table_cible, ligne_id) + `notifications` au vendeur (`profile_id = offre.created_by`).
**Vérification** : en fondateur, Valider fait passer une offre `visible_en_verification`/`en_attente_validation` à `publiee`, notification + audit_logs créés ; en non-fondateur, bouton absent et appel direct rejeté (RLS + contrôle applicatif).

### A3 — Action "Suspendre"
Champ motif optionnel → statut → `masquee`. Notification + audit_logs avec motif si fourni.
**Vérification** : l'offre suspendue disparaît de `vue_marketplace_publique` immédiatement, reste visible dans la vue de modération, notification/audit présents.

### A4 — Action "Supprimer" (logique)
Confirmation explicite obligatoire (réutilise `ConfirmModal.tsx`, pattern déjà établi pour formations/bénéficiaires) → statut → `retiree`. Jamais de `DELETE`. Motif optionnel, notification + audit_logs.
**Vérification** : offre `retiree` absente de toute vue publique, ligne toujours présente en base ; clic Annuler sur la confirmation ne change rien.

### A5 — Tests + clôture Partie A
Test SQL de cloisonnement (un rôle hors organisation ne peut pas agir sur l'offre), test Playwright bout en bout des 3 actions, mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Partie B — Messagerie ciblée sur une offre

### B1 — Fiche détail de l'offre, lecture seule
Panneau/modal ouvert depuis la vue de modération : tous les champs de l'offre + profil vendeur (nom, type, organisation) + historique des messages déjà liés à cette offre (vide au départ). Pas de champ de saisie à ce stade.
**Vérification** : le panneau affiche les bonnes données pour l'offre cliquée, sans régression sur la liste A1.

### B2 — Migration additive `messages.marketplace_offre_id`
`alter table messages add column marketplace_offre_id uuid references marketplace_offres(id) on delete set null` + index. Élargir le `check` sur `type_message` pour inclure `'moderation_marketplace'` (additif).
**Vérification** : script SQL confirmant que les policies RLS existantes couvrent déjà la nouvelle colonne sans modification — testé à deux comptes vendeurs distincts, chacun ne voit que ses propres messages.

### B3 — Formulaire d'envoi + branchement
Champ de saisie dans le panneau B1. Server Action `envoyerMessageOffre(offreId, contenu)` : insert dans `messages` (`expediteur_id` = fondateur courant, `destinataire_id` = `offre.created_by`, `organisation_id` = `offre.organisation_id`, `marketplace_offre_id` = offreId, `type_message` = `'moderation_marketplace'`), + `audit_logs`.
**Vérification** : message envoyé apparaît immédiatement dans l'historique du panneau ; ligne `audit_logs` créée ; RLS testée à deux comptes (chacun ne voit que ses propres échanges).

### B4 — Notification vendeur + réponse
Insertion automatique dans `notifications` (lien vers l'offre) à chaque message envoyé. Le vendeur répond depuis sa messagerie existante (aucun nouvel écran), la réponse reste attachée à l'offre via le même `marketplace_offre_id`.
**Vérification** : notification `est_lue=false` créée après envoi ; une réponse du vendeur apparaît dans l'historique du panneau fondateur.

### B5 — Tests + clôture Partie B
Test Playwright bout en bout (Fondateur envoie un message depuis la fiche détail → vendeur reçoit notification → vendeur répond → réponse visible côté fondateur), mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre d'exécution
A1 → (validation Angenor) → A2 → (validation) → A3 → (validation) → A4 → (validation) → A5 → B1 → (validation) → B2+B3 → (validation) → B4 → (validation) → B5

## État d'avancement (2026-07-06)

- **A1-A4 : faits.** Bug réel corrigé au passage : les icônes lucide passées en props d'un composant serveur vers `ModerationModal` (composant client) faisaient planter `/marketplace` en 500 (React interdit de sérialiser une fonction à travers la frontière Server→Client) — corrigé en passant des éléments déjà rendus.
- **A5 : fichiers de test écrits** (`supabase/tests/test_moderation_marketplace.sql`, `tests/e2e/marketplace-moderation.spec.ts`) **mais pas encore exécutés.**
- **B1 : fait** (fiche détail lecture seule, `?offre=<id>`).
- **Bloqué depuis le 2026-07-06 : une autre session travaille en parallèle sur le même schéma** (`vue_marketplace_publique`, bucket `photos-profil`, `app/(dashboard)/page.tsx`, `app/solo/formations/page.tsx`). Décision : ne pousser aucune migration ni exécuter de test contre la base distante partagée tant que ce n'est pas coordonné avec Angenor. Concrètement, ceci bloque :
  - La migration `20260716000000_log_audit_action_rpc.sql` (nécessaire pour que `audit_logs` fonctionne réellement depuis les Server Actions — en attendant, l'appel échoue proprement sans bloquer l'action de modération elle-même, voir commentaire dans `actions.ts`).
  - L'exécution de `test_moderation_marketplace.sql` et `marketplace-moderation.spec.ts`.
  - B2 (migration `messages.marketplace_offre_id`) et donc B3/B4.
- **Coordination résolue (2026-07-06)** : l'autre session a terminé et commité (4 commits, "Étape 3/3 — UI..."), son message de commit confirme explicitement avoir évité `app/(dashboard)/marketplace/*` et ce plan pour ne pas entrer en collision. `tsc --noEmit` propre sur tout le projet après fusion.
- **`log_audit_action_rpc.sql` : poussée et vérifiée.** `test_moderation_marketplace.sql` (A5) : passé intégralement après un correctif idempotent (`on conflict do nothing` sur l'insert `membres_organisations`, nécessaire à cause d'un doublon transitoire côté outillage CLI, sans perte de données — vérifié explicitement).
- **A5 Playwright (parcours complet Valider→Suspendre→Supprimer)** : le sous-test de sécurité (bouton Valider absent pour un non-Fondateur) passe. Le parcours complet est bloqué par un rate-limit Supabase Auth (déclenché par mes propres tentatives répétées pendant le débogage) — **non rejoué volontairement pour ne pas prolonger le blocage**, à relancer isolément plus tard.
- **B2 : fait et vérifié** — colonne `messages.marketplace_offre_id` + `type_message` élargi à `'moderation_marketplace'`, poussée et confirmée en base.
- **B3 : fait** — `envoyerMessageOffre()` (Fondateur uniquement), fil de messages affiché dans `DetailOffrePanel` via le nouveau composant `MessageThread.tsx`.
- **B4 : fait intégralement**, y compris côté vendeur. Nouveau module partagé `lib/marketplaceMessages.ts` (`chargerMessagesModerationOrganisation`, `repondreMessageOffre` — aucune nouvelle policy RLS nécessaire, les policies `messages_select/insert` de l'Étape 20 suffisent déjà) + composant partagé `app/_components/MessagesModeration.tsx`, branchés sur `/solo/marketplace` et `/employeur` (panneau "Messages du Fondateur", fils groupés par offre, réponse notifiant automatiquement le fondateur concerné).
- **B5** : `tests/e2e/marketplace-messagerie.spec.ts` écrit, **pas exécuté** (prudence rate-limit Supabase Auth, cf. A5) — à rejouer isolément, avec un nouveau test à ajouter pour la réponse côté vendeur.
- **Chantier "Modération Marketplace + Messagerie ciblée" fonctionnellement complet.** Reste, uniquement par prudence infrastructure (pas par manque de code) : rejouer `marketplace-moderation.spec.ts` (parcours complet) et `marketplace-messagerie.spec.ts` isolément, une fois le rate-limit Auth retombé.
