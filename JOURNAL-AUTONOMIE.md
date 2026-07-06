# Journal d'autonomie — session du 2026-07-07 (nuit)

Fichier de suivi obligatoire pendant le mode autonome complet (`PROMPT-MODE-AUTONOME.md`). Mis à jour à chaque étape importante. Angenor lira ce fichier au réveil pour tout comprendre sans relire le code.

## Ordre appliqué (point 1 de PROMPT-MODE-AUTONOME.md)

1. `CONSIGNES-CLAUDE-CODE-1.md` — déjà fait (sessions précédentes, thème sombre "Boussole d'autonomie").
2. `CONSIGNES-COMPTE-SOLO.md` — déjà fait (Phase B, session précédente).
3. `PROMPT-EDIT-DELETE-FORMATION.md` — déjà fait (Phase C, juste avant cette session autonome).
4. `PROMPT-FIX-MARKETPLACE-PUBLIQUE.md` — **fichier introuvable dans le projet ni dans Downloads** → ignoré, passage au suivant, conformément à la consigne.
5. `PROMPT-MARKETPLACE-GENERALISTE.md` — **fait intégralement** (items 1 à 5, y compris le module Employeur — voir mise à jour ci-dessous).
6. `PROMPT-MARKETPLACE-ENGAGEMENT-1.md` — **fait partiellement** (items 1, 2 et une partie du 4 ; voir points en attente).
7. `PROMPT-GESTION-BENEFICIAIRES.md` — **fait intégralement** (items 1 à 5).
8. Revue de sécurité complète (point 3 de PROMPT-MODE-AUTONOME.md) — **faite**, voir ci-dessous.

## Mise à jour (suite, sur demande d'Angenor "applique toutes les améliorations")

Angenor a demandé de poursuivre sur les points laissés en attente. Complété cette session :

- **Module Employeur** (`/employeur`) construit : mêmes actions Ajouter/Modifier/Retirer/Supprimer que le Compte Solo pour les offres produit/service, formulaire et liste factorisés en composants partagés (`app/_components/OffreForm.tsx`, `OffresListe.tsx`, `lib/marketplaceOffres.ts`) pour ne pas dupliquer la logique entre Solo et Employeur. Compte de test dédié créé (`e2e-employeur-fixture@psychoeduc-manager.local`), vérifié par Playwright.
- **Un troisième trou de permission trouvé et corrigé, plus large que les deux précédents** : `marketplace_offres_delete` (Étape 16) n'avait aucune clause `organisation_id`/`peut_supprimer` du tout (seulement `vendeur_id = auth.uid()`) — aucun compte Solo NI Employeur ne pouvait jamais supprimer une offre, quel que soit son rôle. Corrigé par une policy additionnelle scopée `type_organisation in ('solo','employeur')`.
- **Modifier/Supprimer ajoutés côté Solo aussi** pour les offres produit/service (cohérence avec le pattern déjà établi pour les formations).
- **Profil vendeur enrichi (reste de l'item 4 d'Engagement)** : la note de satisfaction du Profil public ne comptait auparavant que les avis de formations — corrigée pour agréger avis de formations ET d'offres marketplace (nouvelle vue `vue_satisfaction_vendeur`), ajout d'un compteur réel "Clients marketplace" (acheteurs distincts, formations + offres confondues), et un badge "NOUVEAU VENDEUR" réel (calculé sur la date de création de l'organisation, jamais une valeur inventée) sur les cartes de la marketplace publique.
- **Un bug de routing réel et significatif découvert et corrigé, sans rapport avec les prompts mais bloquant pour deux tests existants** : `app/page.tsx` (prototype thème clair, jamais nettoyé depuis les tout premiers commits, avant même la refonte "Boussole d'autonomie") et `app/(dashboard)/page.tsx` (le vrai tableau de bord actuel) résolvent tous deux vers `/` — collision de route identique dans l'esprit à celle déjà rencontrée avec `(solo)` vs `(dashboard)`, mais celle-ci n'a jamais fait planter le build : Next.js/Turbopack a silencieusement choisi l'un des deux de façon non déterministe selon l'état du serveur de dev, au lieu d'une erreur claire. Corrigé en supprimant `app/page.tsx` (fichier mort, aucun import ailleurs dans le code). Symptôme observé : `tests/e2e/auth.spec.ts` et `dashboard.spec.ts` échouaient de façon reproductible (bouton de menu absent, libellé "Essais gratuits" au lieu de "Essais gratuits en cours") malgré un redémarrage du serveur de dev — la cause réelle n'était pas un cache périmé mais bien ce second fichier concurrent.

Suite complète après ces correctifs : **18/18 tests Playwright verts**, `tsc --noEmit` propre.

## Résumé livrable (lisible en 30 secondes)

- **Marketplace généralisé** : `marketplace_offres` (déjà présent depuis l'Étape 16 mais jamais utilisé par aucune UI) étendu avec médias, stock/livraison, image de couverture obligatoire avant publication. Nouvelle page `/solo/marketplace` : navigation publique unifiée (formations + produits/services) avec onglets par type et filtre par type de vendeur, recherche libre, favoris, achat/inscription en un clic, formulaire de soumission produit/service (modération Fondateur obligatoire, comme prévu depuis l'origine). Nouvelle page `/solo/favoris`.
- **Avis vérifiés + compteur d'achats réel** : un vrai trou de confiance corrigé (`marketplace_avis` acceptait n'importe quel avis sans achat réel) — désormais aligné avec `avis_formations` (Phase C) : impossible de laisser un avis sans commande/inscription confirmée. Compteurs d'achats et notes moyennes 100% réels via `vue_marketplace_publique`, jamais inventés.
- **Gestion des bénéficiaires** : suppression avec garde-fou (historique = IGA/messages/séances), classification automatique calculée à la lecture (Nouveau/Suivi actif/Inactif/Archivé/Refusé), file d'attente de demandes d'inscription (Valider/Refuser + motif), messagerie typée (suivi/entretien/signalement) avec **signalement jamais visible par le bénéficiaire concerné** (vérifié par test SQL explicite), fil chronologique unifié (évaluations + messages), rapport de bilan réutilisé tel quel (aucune brique dupliquée).
- **Un deuxième trou de permission réel trouvé et corrigé** (même famille que celui de la session précédente sur `formations`) : `administrateur` (rôle du propriétaire de tout Compte Solo) avait aussi `peut_supprimer=false` sur `beneficiaires` — corrigé par une policy RLS additionnelle scopée aux organisations solo.
- **4 nouvelles suites de tests SQL + 3 nouveaux fichiers Playwright**, tous verts. Suite complète : 16/16 tests verts, `tsc --noEmit` propre.
- **3 points explicitement laissés en attente de l'avis d'Angenor** (voir section dédiée) : coexistence des deux systèmes marketplace, module Employeur non construit, et la majorité de `PROMPT-MARKETPLACE-ENGAGEMENT-1.md` non traitée (items 3 à 6, dont tout ce qui dépend d'un prestataire de paiement inexistant).

## Hypothèses prises sans validation directe d'Angenor

**Découverte majeure avant de commencer `PROMPT-MARKETPLACE-GENERALISTE.md` : la table générique demandée existe déjà, sous un autre nom, depuis l'Étape 16 de l'architecture v5 d'origine — `marketplace_offres`** (`vendeur_type`/`vendeur_id`, `type_offre` déjà `formation|service|produit`, workflow de modération fondateur `en_attente_validation→publiee/refusee`, `marketplace_commandes` avec split de commission, `marketplace_avis`, `marketplace_signalements` avec masquage automatique au seuil). **Cette table n'était utilisée par AUCUNE UI d'insertion** — seule la page admin `/marketplace` du Cockpit Fondateur la lit en lecture seule. Pendant la Phase B (session précédente, module Compte Solo), j'ai construit un second système de marketplace entièrement séparé (`formations` + `inscriptions_formations` + `vue_marketplace_formations`) sans avoir conscience de l'existence de `marketplace_offres` — exactement la situation que ce prompt demande d'éviter ("ne pas faire coexister deux systèmes parallèles").

**Décision prise pour ne pas bloquer, mais signalée explicitement ci-dessous pour l'avis d'Angenor au réveil** : je ne fusionne PAS les deux systèmes ni ne migre les données de `formations` vers `marketplace_offres` cette nuit, car (1) `formations` porte une mécanique pédagogique réelle et déjà testée (cours, progression, certificats auto-délivrés) que `marketplace_offres`/`marketplace_commandes` ne modélise pas et n'a pas vocation à modéliser sans repenser tout le flux de certification ; (2) une migration de données réelles + réécriture de tout le module Compte Solo formations en pleine nuit, sans confirmation, serait exactement le type d'opération risquée que `PROMPT-MODE-AUTONOME.md` (point 5) demande de signaler plutôt que d'exécuter à l'aveugle. À la place : `marketplace_offres` devient le support des offres **non pédagogiques** (produit/service), qui n'existaient nulle part avant (aucune donnée à casser), et une vue combinée (`vue_marketplace_publique`) unit les deux sources pour l'affichage public — chacune gardant ses propres règles déjà en place (formations = auto-publication par le formateur, sans modération, comme aujourd'hui ; produit/service = modération fondateur obligatoire, comme le prévoyait déjà `marketplace_offres` depuis l'Étape 16).

## Points de sécurité trouvés et corrigés

Revue menée sur tout le code écrit cette nuit (marketplace généraliste + gestion bénéficiaires), selon les 5 axes du point 3 de `PROMPT-MODE-AUTONOME.md` :

1. **Contrôle d'accès** — vérifié par test SQL explicite (pas juste relu) :
   - Un bénéficiaire ne voit que ses propres jalons/objectifs (cloisonnement organisation testé dans `test_compte_solo_ameliorations.sql`).
   - **Un signalement n'est jamais visible par le bénéficiaire concerné**, même en étant connecté avec son propre compte (`test_gestion_beneficiaires.sql`, vérification explicite à 0 résultat).
   - Un tiers ne voit ni les favoris, ni les messages, ni les objectifs d'un bénéficiaire hors de son organisation.
   - Compte Solo scoping : toutes les nouvelles requêtes (`marketplace/page.tsx`, `favoris/page.tsx`, `beneficiaires/[id]/page.tsx`) filtrent explicitement par `organisation_id` ou par une vue déjà `security_invoker`.
2. **Validation des entrées côté serveur** — chaque nouvelle Server Action (`creerOffre`, `ajouterBeneficiaire`, `envoyerMessageBeneficiaire`, `refuserDemande`…) revalide les champs requis et les valeurs d'enum (`type_offre`, `type_message`) avant tout insert, en plus des contraintes `CHECK` en base (défense en profondeur, pas une confiance aveugle dans le client).
3. **Secrets** — grep ciblé (`sk_live`, `sk_test`, `service_role`, motifs de clé API) sur `app/`, `lib/`, `supabase/migrations/` : aucun résultat. Aucune nouvelle clé introduite cette nuit (aucun prestataire de paiement branché).
4. **Injection SQL / XSS** :
   - **Un vrai problème trouvé et corrigé** : `app/solo/marketplace/page.tsx` interpolait directement la recherche libre de l'utilisateur (`q`) dans une chaîne de filtre PostgREST (`.or(\`titre.ilike.%${q}%...\`)`) sans nettoyage. Ce n'est pas une injection SQL (PostgREST/RLS restent en dessous, un attaquant ne peut pas sortir du jeu de lignes déjà autorisé par RLS), mais un caractère comme `,` ou `)` aurait pu casser ou détourner le filtre de recherche prévu. Corrigé en retirant les caractères `,().` de l'entrée avant de construire la chaîne, avec un plafond de longueur (200 caractères). Revérifié : les tests Playwright de filtre marketplace passent toujours après correctif.
   - Aucun `dangerouslySetInnerHTML` nulle part dans le projet (grep confirmé) — React échappe déjà tout le contenu utilisateur affiché (messages, avis, bio, descriptions).
5. **Permissions sur les nouvelles routes** — toutes les nouvelles tables (`favoris_marketplace`) ont leur RLS activée dès la création, jamais après. Un deuxième trou de permission réel trouvé (voir résumé) et corrigé sur `beneficiaires` pour les comptes Solo.

Aucun autre problème de sécurité identifié sur le périmètre touché cette nuit.

## Points en attente de l'avis d'Angenor (point 5 de PROMPT-MODE-AUTONOME.md)

1. **Deux systèmes de marketplace coexistent désormais consciemment** (`formations`/pédagogique, non modéré, vs `marketplace_offres`/produit-service, modéré par le fondateur) — voir hypothèse ci-dessus. Si Angenor souhaite à terme que les formations passent aussi par la modération fondateur et le split de commission de `marketplace_offres`, c'est une vraie décision de produit (change le modèle économique actuel où le formateur garde 100% de ses ventes de formations) à trancher avec lui, pas à deviner seul. Toujours d'actualité après le module Employeur (qui, lui, publie exclusivement via `marketplace_offres`).
2. ~~Module Employeur non construit~~ — **fait** dans la mise à jour ci-dessus.
3. **`PROMPT-MARKETPLACE-ENGAGEMENT-1.md` : items 1, 2 et une partie du 4 faits (avis vérifiés, compteur d'achats réel, favoris, note de satisfaction combinée, badge nouveau vendeur).** Reste non traité, faute de temps : "Vu récemment", recommandations personnalisées par tranche IGA, recherche par besoin exprimé pour les offres marketplace (déjà fait côté formations), taux de réponse aux messages (**volontairement pas implémenté** : aucune donnée réelle ne permet de le calculer honnêtement — la messagerie bénéficiaire est à sens unique, il n'existe aucune messagerie acheteur↔vendeur pré-achat dans l'app ; l'inventer serait afficher un chiffre fictif, contraire au principe même du document), mise en avant tournante des nouveaux vendeurs (le badge existe, pas encore de section dédiée en rotation), parcours recommandés, programme de fidélité, et tout ce qui dépend d'un prestataire de paiement — toujours inexistant dans le projet.
4. *(complété au fur et à mesure)*
