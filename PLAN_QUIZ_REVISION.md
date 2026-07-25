# Plan — Module "Quiz de révision" (`handoff-quiz-revision-ia-2.md`)

Référence : document fourni intégralement dans la conversation. Section 12 du document propose déjà un ordre d'implémentation — ce plan le reprend, adapté au schéma réel du projet (le document a été écrit sans connaissance exacte du schéma actuel).

## Écarts par rapport au document source (à respecter, pas de duplication)

1. **`quiz_documents` n'est pas une nouvelle table** : `documents_beneficiaires` (Étape 5) existe déjà avec `beneficiaire_id/organisation_id/type_document/nom_fichier/url_fichier/televerse_par`. Étendue additivement (`type_source`, `source_url`, `duree_video_sec`, `valide_par`, `valide_at`) plutôt que dupliquée.
2. **`users(id)` du document n'existe pas dans ce projet** : partout remplacé par `profiles(id)`, comme le reste du schéma.
3. **Pas de ledger financier parallèle** : le projet a déjà `mouvements_financiers` (registre append-only central, Étape 15) et une dette technique documentée ("réconciliation transactions_wallet ↔ mouvements_financiers toujours en attente") — créer un deuxième ledger isolé (`credits_transactions` totalement autonome) reproduirait exactement cette même erreur. `credits_transactions` reste une table dédiée (nécessaire pour la logique crédits/quiz), mais toute transaction avec mouvement d'argent réel écrit aussi une ligne dans `mouvements_financiers` (`reference_source_table='credits_transactions'`).
4. **L'accès parent n'a pas besoin d'un nouveau mécanisme** : `liens_parent_beneficiaire` + l'Espace Parent existent déjà (Compte Structure, étape 7/10) — à réutiliser tel quel pour l'accès "achat crédits + lecture solde/score", pas de nouveau système d'invitation.
5. **Maquette `revisions-quiz.html` mentionnée en section 4 du document n'a pas été fournie** dans cette conversation — l'UI sera construite selon le design system déjà en place (Panel/StatCard/StatusPill), pas selon une maquette absente. À fournir si un rendu précis est attendu.

## Blocage réel constaté — signalé, pas contourné

**Aucune clé API n'est configurée dans `.env.local`** : ni prestataire de paiement (PayDunya/CinetPay/FedaPay/Kkiapay), ni clé Claude (`ANTHROPIC_API_KEY`). Conséquence directe sur l'ordre d'implémentation :
- Étapes 1-5 et 9-10 (schéma, moteur gratuit, écran de préférence, UI, chronométrage, encouragements) : **aucune dépendance externe, buildable et testable maintenant.**
- Étape 6 (crédits + paiement sandbox) : le code peut être écrit (webhook, décrément/incrément solde) mais **ne pourra pas être testé de bout en bout** sans un compte sandbox chez un des 4 agrégateurs — à obtenir avant de considérer cette étape close.
- Étape 7 (génération Haiku) : **strictement bloquée sans `ANTHROPIC_API_KEY`** — le code sera écrit mais non exécutable/testable tant que la clé n'est pas fournie.
- Étape 8 (vidéo/YouTube) : dépend de l'étape 7 (même contrainte IA) + d'une clé YouTube Data API, également absente.
- **Point explicitement ouvert dans le document lui-même** (section 7) : flux parent (compte allégé vs lien de paiement externe) — le document recommande de commencer par le lien externe ; retenu ici, mais à confirmer avec Angenor avant l'étape 6.

## Décision structurante

**Le palier gratuit (étapes 1-5) est construit et livré en premier, indépendamment de tout le reste** — c'est déjà la recommandation du document ("livrable immédiatement utilisable, sans dépendance à un système de crédits") et c'est aussi la seule partie non bloquée par l'absence de clés API. Les étapes 6-8 seront préparées (schéma, structure de code, endpoints stubés avec message d'erreur clair) mais pas branchées sur de vrais appels externes tant que les identifiants ne sont pas fournis.

## Tâches

### T1 — Schéma + RLS (section 2, adapté)
- `documents_beneficiaires` étendue (`type_source`, `source_url`, `duree_video_sec`, `valide_par`, `valide_at`).
- Nouvelles tables : `quiz`, `quiz_tentatives`, `credits_revision`, `credits_transactions` (FK vers `profiles`/`beneficiaires`, jamais `users`).
- `quiz.preference_initiale` (`rapide`/`excellence`, section 3).
- RLS : bénéficiaire propriétaire (`beneficiaires.profile_id = auth.uid()`) + équipe pédagogique (`peut_lire('quiz', organisation_id)`) ; jamais un autre bénéficiaire. `credits_revision`/`credits_transactions` : écriture uniquement via fonction serveur (SECURITY DEFINER), jamais un insert direct côté client — lecture bénéficiaire + Directeur/Promoteur de sa structure (réutilise le rôle déjà en place, pas un nouveau).
- **Vérification** : script SQL de cloisonnement (bénéficiaire A ne voit jamais le quiz/solde de crédits de bénéficiaire B, même organisation), testé aussi pour le parent (lecture solde/score uniquement, jamais le détail des réponses).

### T2 — Moteur de génération gratuit, sans IA (section 5.1)
- Pipeline NLP classique (découpage phrases, détection définitions par regex, extraction mots-clés, texte à trous), en TypeScript standard (logique métier découplée du fournisseur cloud, principe déjà appliqué à `lib/iga.ts`).
- Garde-fou : jamais de génération sur document `valide_par is null`.
- **Vérification** : test end-to-end (upload document → validation formateur → génération → quiz stocké avec `palier='gratuit'`), Playwright.

### T3 — Écran de préférence d'objectif (section 3)
- Mapping statique objectif → format conseillé, aucune génération dynamique. Bénéficiaire toujours libre de choisir un autre format.
- **Vérification** : Playwright (les deux choix affichent la bonne recommandation, le choix reste modifiable à chaque session).

### T4 — UI Quiz + Chronométrage (sections 4 UI, 6)
- Écran de passation (QCM palier gratuit), jauge par question (30-45s, pas de pénalité au dépassement).
- **Vérification** : Playwright (jauge se vide, passage automatique à la question suivante sans pénalité de score).

### T5 — Encouragement/rappels sobres (section 9)
- Messages post-session factuels, pas de gamification. Rappels de répétition espacée basique (intervalle fixe) pour le palier gratuit uniquement à ce stade (la version "intelligente" dépend de l'IA, étape 7).
- **Vérification** : contenu textuel non-gamifié vérifié par test, pas de mécanique de points en base.

### T6 — Crédits + paiement (section 7) — code écrit, **non testable sans sandbox**
- `credits_revision`/`credits_transactions` + fonction serveur de crédit/débit (jamais d'écriture client directe).
- Webhook de confirmation générique (statut `en_attente→confirme`, incrémente le solde + écrit une ligne `mouvements_financiers` liée).
- Flux parent : lien de paiement externe (pas de nouveau compte), réutilise `liens_parent_beneficiaire` pour l'affichage solde/score au parent déjà connecté à l'Espace Parent existant.
- **Décision à confirmer avec Angenor avant de considérer cette étape close** : lien externe vs compte allégé (le document lui-même le liste comme point ouvert).
- **Vérification** : impossible de compléter tant qu'un compte sandbox (PayDunya/CinetPay/FedaPay/Kkiapay) n'est pas fourni — le critère de vérification réel est un paiement sandbox confirmé de bout en bout.

### T7 — Génération Haiku (section 5.2) — code écrit, **bloqué sans `ANTHROPIC_API_KEY`**
- Endpoint serveur, prompt système du document, validation JSON stricte, débit crédit uniquement après succès.
- **Vérification** : impossible sans la clé — critère réel = un appel Haiku réel retournant un JSON valide, quiz stocké avec `palier='payant'`.

### T8 — Sources vidéo (section 4) — dépend de T7
- Différé tant que T7 n'est pas débloqué (même dépendance IA + nécessite une clé YouTube Data API, également absente).

## Ordre d'exécution
T1 → T2 → T3 → T4 → T5 (livrable complet, palier gratuit) → **pause pour obtention des clés API/sandbox** → T6 → T7 → T8
