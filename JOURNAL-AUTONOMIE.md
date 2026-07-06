# Journal d'autonomie — session du 2026-07-07 (nuit)

Fichier de suivi obligatoire pendant le mode autonome complet (`PROMPT-MODE-AUTONOME.md`). Mis à jour à chaque étape importante. Angenor lira ce fichier au réveil pour tout comprendre sans relire le code.

## Ordre appliqué (point 1 de PROMPT-MODE-AUTONOME.md)

1. `CONSIGNES-CLAUDE-CODE-1.md` — déjà fait (sessions précédentes, thème sombre "Boussole d'autonomie").
2. `CONSIGNES-COMPTE-SOLO.md` — déjà fait (Phase B, session précédente).
3. `PROMPT-EDIT-DELETE-FORMATION.md` — déjà fait (Phase C, juste avant cette session autonome).
4. `PROMPT-FIX-MARKETPLACE-PUBLIQUE.md` — **fichier introuvable dans le projet ni dans Downloads** → ignoré, passage au suivant, conformément à la consigne.
5. `PROMPT-MARKETPLACE-GENERALISTE.md` — **fait** (items 1 à 4 ; item 5 "module Employeur" différé, voir points en attente).
6. `PROMPT-MARKETPLACE-ENGAGEMENT-1.md` — **fait partiellement** (items 1 et 2 sur 6 ; voir points en attente).
7. `PROMPT-GESTION-BENEFICIAIRES.md` — **fait intégralement** (items 1 à 5).
8. Revue de sécurité complète (point 3 de PROMPT-MODE-AUTONOME.md) — **faite**, voir ci-dessous.

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

1. **Deux systèmes de marketplace coexistent désormais consciemment** (`formations`/pédagogique, non modéré, vs `marketplace_offres`/produit-service, modéré par le fondateur) — voir hypothèse ci-dessus. Si Angenor souhaite à terme que les formations passent aussi par la modération fondateur et le split de commission de `marketplace_offres`, c'est une vraie décision de produit (change le modèle économique actuel où le formateur garde 100% de ses ventes de formations) à trancher avec lui, pas à deviner seul.
2. **Module de gestion d'offres côté compte Employeur (item 5, priorité la plus basse de `PROMPT-MARKETPLACE-GENERALISTE.md`, explicitement listée en dernier par le document lui-même) non construit cette nuit**, faute de temps face au reste du backlog (Engagement + Gestion bénéficiaires, listés après dans l'ordre imposé). Aujourd'hui, un compte Employeur n'a donc pas d'équivalent à `/solo/marketplace` pour publier ses propres offres (`marketplace_offres` le permettrait techniquement côté schéma — RLS déjà générique par `organisation_id` — il manque seulement l'écran). Prochaine étape naturelle si cette fonctionnalité redevient prioritaire.
3. **`PROMPT-MARKETPLACE-ENGAGEMENT-1.md` : seuls les points 1 et 2 (avis vérifiés + compteur d'achats réel, favoris) ont été construits cette nuit** — ce sont les deux premiers de la priorisation suggérée par le document lui-même. Points 3 à 6 non traités faute de temps (`PROMPT-GESTION-BENEFICIAIRES.md` restait à faire, dans l'ordre imposé) : recommandations personnalisées par tranche IGA, "Vu récemment", parcours recommandés groupant plusieurs offres, programme de fidélité, et tout ce qui dépend d'un prestataire de paiement (paiement en un clic, paiement fractionné, garantie satisfait-ou-remboursé) — ce dernier bloc est de toute façon explicitement gated par le document sur "le prestataire de paiement déjà intégré", qui n'existe toujours pas dans ce projet (cf. `paiements_formation`/`marketplace_commandes`, tous deux de simples registres sans mouvement d'argent réel). Rien de tout cela n'est fait semblant/simulé.
4. *(complété au fur et à mesure)*
