# Plan — Tableau de bord bénéficiaire v2 (enrichissement ICC + Espace Tuteurs IA)

Référence : prompt fonctionnel + maquette HTML fournis intégralement dans la conversation du 2026-07-25. Règle absolue du document source : **zéro régression, aucune fonctionnalité existante supprimée.** Cartographie complète de l'existant effectuée avant ce plan (agent Explore, résumé ci-dessous) — voir section "Écarts" pour ce qui en découle.

## Cartographie de l'existant (confirmée avant tout code)

Routes bénéficiaire actuelles (`app/mon-espace/[beneficiaireId]/`) : accueil (Boussole IGA + Profil professionnel + Projet de vie + résumé révisions), `projets-vie`, `revisions` (+ `revisions/quiz/[quizId]`), `cv`, `marketplace`, `cercles` (+ `cercles/[cercleId]`), `insertion`, `intelligence-economique`, `capital-social`.

**Confirmé ABSENT du projet à ce jour** (recherche exhaustive, zéro résultat) : Flashcards, Simulation d'entretien, Session professionnelle (au sens coaching/rdv — `entretiens` existe mais c'est un dossier clinique praticien↔bénéficiaire, jamais exposé au bénéficiaire, sans rapport), page Notifications côté bénéficiaire (la table `notifications` existe et est déjà utilisée côté Solo/Cockpit Fondateur, juste jamais exposée à `/mon-espace`), Abonnement au niveau bénéficiaire individuel (`abonnements`/`licences` existent mais au niveau organisation Solo/Structure/Employeur, rien d'équivalent pour un compte bénéficiaire).

## Écarts par rapport au prompt source (à respecter, pas de duplication)

1. **Session professionnelle = le module Insertion professionnelle existant, pas un doublon.** `/insertion` (`offres_emploi`, `candidatures`, `entreprises_partenaires`) couvre déjà exactement ce que "Session professionnelle" décrit dans le prompt (préparer son avenir professionnel). Décision : renommer l'intitulé affiché ("Session professionnelle" plutôt que "Insertion professionnelle" dans la nouvelle organisation par catégories), garder la route et les données telles quelles — aucune nouvelle table, aucune duplication.
2. **Simulation d'entretien = un mode spécialisé de l'Espace Tuteurs IA, pas un second système de conversation.** Angenor a confirmé vouloir la construire. Plutôt que bâtir un moteur de dialogue séparé, elle réutilise le même schéma `tuteur_sessions`/`tuteur_messages`/crédits (Lot D) avec un `objectif` dédié (`entretien` plutôt que `tutorat`) et une persona "Recruteur" pré-configurée par défaut — même garde-fous, même RLS, même débit de crédits. Ce choix évite exactement le piège que ce projet a déjà rencontré plusieurs fois ("ne jamais construire un deuxième système pour un besoin déjà couvert par un système existant, même sous un autre nom").
3. **Abonnement bénéficiaire : schéma posé maintenant, aucune facturation réelle.** Angenor a confirmé vouloir au moins la structure de base. Nouvelle table `abonnements_beneficiaire` (schéma minimal : `beneficiaire_id`, `formule`, `statut`, `date_debut`, `date_fin`, `renouvellement_auto`), **sans aucune colonne de paiement récurrent réel** (pas de `moyen_paiement`/`transaction_ref` tant qu'aucun prestataire n'est choisi) — juste assez pour qu'une page "Mon abonnement" affiche un statut réel non fictif. Toute logique de débit/renouvellement automatique reste non câblée, avec le même garde-fou explicite que Quiz T6/CV (bloqué sans prestataire configuré).
4. **Barre de navigation basse : ajoutée dans `app/mon-espace/layout.tsx`.** Angenor a confirmé vouloir la vraie barre façon appli mobile, pas seulement un regroupement de cartes. Elle vient en **supplément** de la page d'accueil catégorisée (Lot A), jamais en remplacement : la maquette n'affiche que 4 raccourcis (Accueil/Révisions/Boussole/Profil), les ~10 destinations réelles du module restent toutes accessibles depuis la page d'accueil catégorisée — aucun lien n'est retiré de la navigation normale, la barre basse n'est qu'un raccourci rapide vers les 4 écrans les plus consultés.
5. **ICC : pas de nouvelle table de "compétences concrètes".** `icc_competences.libelle` existe déjà (ex. "Sait utiliser un rabot") — le score agrégé (%) est affiché aujourd'hui, jamais le libellé des compétences validées individuellement. Il s'agit d'un enrichissement d'affichage (lire une colonne déjà là) et d'une petite extension de lecture, pas d'un nouveau schéma.
6. **Crédits : un seul système, étendu, pas dupliqué.** `credits_revision` (solde unique par bénéficiaire) et `credits_transactions` sont aujourd'hui couplés au quiz payant (`debiter_credit_revision` décrémente toujours de 1, sans notion de fonctionnalité). Extension additive : `debiter_credit_revision(p_beneficiaire_id, p_montant int default 1)` (compatible avec les appels existants) + colonne `credits_transactions.module text` pour la traçabilité comptable (`quiz_revision` / `tuteur_ia` / `cv`, etc.). Le solde reste unique et partagé — pas de deuxième portefeuille, y compris pour la Simulation d'entretien (écart 2).
7. **Objectifs↔ICC : lien additif, pas de refonte.** `objectifs_beneficiaire` a déjà `date_cible` (échéance) mais aucun lien vers une compétence. Ajout d'une colonne nullable `competence_id` (FK `icc_competences`), jamais obligatoire — un objectif reste valide sans compétence liée.

## Décision structurante

Ce chantier est scindé en lots indépendants, livrés dans cet ordre (du moins risqué/plus rapide au plus gros morceau) :

- **Lot A** — Barre de navigation basse + réorganisation en 4 catégories (accueil bénéficiaire). Changement de shell (`app/mon-espace/layout.tsx`) : le plus structurant visuellement, livré en premier pour que tout le reste s'y intègre dès sa construction plutôt que d'être retouché après coup.
- **Lot B** — Enrichissement ICC (libellés concrets par compétence, pas seulement le %) : lecture supplémentaire sur des tables déjà en place.
- **Lot C** — Notifications bénéficiaire + lien Objectifs↔ICC + relabellisation Session professionnelle : petits ajouts indépendants, réutilisent des tables déjà en place.
- **Lot D** — Espace Tuteurs IA (tutorat documentaire + Simulation d'entretien comme mode spécialisé) : le plus gros morceau, nouveau schéma (sessions/messages/personas), nouvelle UI de conversation multi-tours, extension du système de crédits. **Bloqué en pratique sans `ANTHROPIC_API_KEY`** (même situation que Quiz T7 et CV) — le code sera écrit et vérifié en isolation (prompts, parsing, RLS, débit de crédits) mais non testable de bout en bout tant que la clé n'est pas fournie.
- **Lot E** — Abonnement bénéficiaire (schéma + page de statut, aucun paiement réel) : dernier lot, le moins urgent fonctionnellement (aucun flux d'achat possible tant qu'aucun prestataire n'est choisi).

CV (déjà livré cette session) et Quiz de révision (déjà livré) ne sont pas retouchés dans ce plan sauf mention explicite.

## Tâches

### Lot A — Barre de navigation basse + réorganisation en catégories
- `app/mon-espace/_components/BottomNav.tsx` (nouveau, client) : 4 raccourcis fixes (Accueil / Révisions / Boussole / Profil professionnel), actif visuellement selon la route courante (`usePathname`), `print:hidden`.
- `app/mon-espace/layout.tsx` : ajoute la barre en bas du shell, padding-bottom du contenu ajusté pour ne jamais la faire recouvrir le pied de page existant.
- `app/mon-espace/[beneficiaireId]/page.tsx` : introduire 4 en-têtes de section (Apprendre / Me connaître / Mon avenir / Mes services) et redistribuer les cartes/liens existants dessous, sans en supprimer aucun (Session professionnelle = intitulé affiché pour la carte `/insertion` existante, écart 1).
- **Vérification** : `tsc --noEmit`, smoke test Playwright (tous les liens existants toujours présents et cliquables, barre basse visible sur toutes les sous-routes), non-régression `navigation.spec.ts`.

### Lot B — ICC enrichi (compétences concrètes)
- `lib/iccServer.ts` : étendre `chargerFormationsAvecIcc` (ou nouvelle fonction dédiée) pour renvoyer, en plus des scores agrégés, la liste des compétences (`icc_competences.libelle`) avec leur statut individuel (maîtrisée/niveau/tag observé) — reformulée en phrase ("Tu sais...", "Tu es...") côté UI, jamais en base (pas de texte généré stocké).
- UI : la carte ICC existante (par formation) affiche désormais aussi 2-3 libellés concrets par dimension, pas seulement le %.
- **Vérification** : test standalone du mapping score→phrase, smoke Playwright sur `/mon-espace/[id]`.

### Lot C — Notifications bénéficiaire + Objectifs↔ICC
- Nouvelle route `app/mon-espace/[beneficiaireId]/notifications/page.tsx`, réutilise la table `notifications` existante et le composant de cloche (adapté du pattern `NotificationsBell.tsx` de `/solo`), ajoutée à `app/mon-espace/layout.tsx` (en-tête).
- Migration additive : `objectifs_beneficiaire.competence_id uuid references icc_competences(id)`, nullable. UI `projets-vie/page.tsx` affiche la compétence liée si présente, avec une action suggérée (lien vers révisions/formation concernée).
- **Vérification** : `tsc --noEmit`, test SQL de la migration additive, smoke Playwright.

### Lot E — Abonnement bénéficiaire (schéma + statut, sans paiement réel)
- Migration additive : `abonnements_beneficiaire` (`beneficiaire_id`, `formule text`, `statut` check `actif|expire|suspendu`, `date_debut`, `date_fin`, `renouvellement_auto boolean default false`, `created_at`) — aucune colonne de paiement récurrent réel (écart 3).
- Nouvelle route `app/mon-espace/[beneficiaireId]/abonnement/page.tsx` : affiche le statut réel (actif/expiré/aucun), jamais une valeur fictive. Aucune action d'achat/renouvellement tant qu'aucun prestataire n'est configuré — même garde-fou explicite que `demarrerGenerationCv`.
- **Vérification** : `tsc --noEmit`, test SQL de la migration, smoke Playwright (page affiche "aucun abonnement" pour un bénéficiaire sans ligne, pas une erreur).

### Lot D — Espace Tuteurs IA (+ Simulation d'entretien comme mode spécialisé)
- Schéma (migration additive) : `tuteur_personas` (nom, domaine, description, `objectif` check `tutorat|entretien`, prompt_systeme_base — gérés par le Fondateur, pas par le bénéficiaire ; seed d'une persona "Recruteur" avec `objectif='entretien'`), `tuteur_sessions` (beneficiaire_id, document_id nullable — nullable car un entretien n'a pas forcément de document source, persona_id, credits_consommes, statut, created_at), `tuteur_messages` (session_id, role `user|assistant`, contenu, created_at).
- Extension crédits (voir Écart 6) : `debiter_credit_revision` généralisée, `credits_transactions.module`.
- RLS : session/messages visibles uniquement par le bénéficiaire propriétaire (+ équipe pédagogique en lecture), jamais un autre bénéficiaire — même schéma de policies que `documents_beneficiaires`/`quiz_revision`.
- Garde-fou personas de personnes réelles identifiables (§9 du prompt) : `prompt_systeme_base` doit systématiquement injecter une clause "simulation inspirée de, jamais une conversation réelle, jamais de citation inventée présentée comme authentique" — vérifiée par test sur le texte du prompt généré, pas seulement documentée en commentaire.
- Action serveur `envoyerMessageTuteur` : vérifie/débite le crédit avant le premier message d'une session (pas à chaque message — coût par session, pas par tour de dialogue, sauf décision contraire à confirmer avec Angenor), appelle Haiku avec l'historique de conversation + contenu du document source (absent pour un entretien), stocke la réponse.
- UI : nouvelle route `.../tuteurs/page.tsx` (sélection document + persona, filtrée par `objectif`) et `.../tuteurs/[sessionId]/page.tsx` (conversation), inspirées du style `revisions/`. La Simulation d'entretien est accessible via le même écran de sélection, persona "Recruteur" pré-filtrée, pas une route séparée.
- **Bloqué sans `ANTHROPIC_API_KEY`** — code écrit et vérifié (prompts, RLS, débit crédits) via tests standalone/SQL, parcours complet non testable tant que la clé est absente.
- **Vérification** : test SQL RLS (cloisonnement session par bénéficiaire), test standalone de construction du prompt (garde-fou personas réelles présent, pour les deux objectifs), smoke Playwright de l'écran de sélection (jusqu'au point de blocage IA).
