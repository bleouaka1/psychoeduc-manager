# Plan — Tableau de bord bénéficiaire v3 (thèmes, layout responsive, voix, flashcards, modèle économique, CV autonome)

Référence : `PROMPT-FINAL-claude-code.md` (prompt maître) + `handoff-vocal-layout-themes.md` + `handoff-icc-cv-navigation-1.md` (révision) + `handoff-quiz-revision-ia-5.md` (révision) + maquettes `palettes-themes.html`, `dashboard-responsive-modele.html`, `flashcards-exemples.html`. Fait suite à `PLAN_DASHBOARD_BENEFICIAIRE_V2.md` (déjà livré) — ce plan **étend**, ne reconstruit pas.

## Confirmé avec Angenor avant codage

**Le palier gratuit du Quiz de révision devient un abonnement payant (200 FCFA/mois).** Renversement explicite d'une garantie déjà documentée et testée ("jamais un mur payant, gratuit à vie") — confirmé par Angenor le 2026-07-25 avant tout changement de schéma. Le filet de sécurité reste non-négociable : toujours une prise en charge visible par un tiers (structure/parent), jamais un blocage sec.

## Écarts / réconciliations avec le travail déjà livré (v2)

1. **Simulation d'entretien existe déjà** (v2, Lot D) comme mode spécialisé de l'Espace Tuteurs IA (`tuteur_personas.objectif='entretien'`) — le nouveau document la redécrit sous 12.2 mais ne change rien à l'implémentation ; reste au même endroit, même schéma, même système de crédits (qui devient le pack crédits de la nouvelle grille tarifaire).
2. **`objectifs_beneficiaire` existe déjà** avec une structure différente (`date_cible`, `statut a_venir/en_cours/atteint`, `competence_id` déjà lié en v2) — le nouveau document en propose une version plus simple (`echeance`, `lie_a_categorie`) par méconnaissance du schéma réel. Conservé tel quel, `lie_a_categorie` n'est pas ajouté (redondant avec `competence_id` déjà présent).
3. **`icc_competences` n'a pas de champ description longue**, seulement `libelle` (court). La maquette affiche un titre court + une phrase complète séparée ("Vous savez réaliser un devis de manière autonome") — ajout d'une colonne `description` nullable, saisie par le formateur, jamais générée automatiquement (même principe qu'en v2 : pas de conjugaison automatique risquée sur texte libre). Absente → repli sur le libellé seul, jamais une phrase inventée.
4. **CV : pivot produit, pas juste un ajustement.** v2 construisait un CV auto-rempli depuis ICC/IGA obligatoirement. Le document révisé veut un générateur **autonome et générique** (formulaire par sections, comme n'importe quelle plateforme de CV), avec un bouton **optionnel** "Pré-remplir depuis mon profil" réservé aux bénéficiaires. Le moteur Haiku et le stockage (`cv_generations`) sont réutilisés, mais le flux applicatif change : un formulaire éditable devient la source de vérité, jamais l'ICC/IGA directement.
5. **Jetons de design déjà en place à réutiliser, pas à réinventer.** `app/globals.css` utilise déjà des variables CSS (`--bg-base`, `--accent-gold`, etc.) avec un mécanisme de surcharge scopée par classe (`.cockpit-fondateur`, `.mon-espace-theme`) — exactement le mécanisme qu'il faut pour les 10 thèmes (`data-theme="..."` sur un wrapper). Le thème actuel (navy/or/Cinzel) devient l'option **"Sobre navy"** de la palette ; un nouveau thème **"Sombre doré"** (Poppins, accents multicolores par module) devient le défaut pour `/mon-espace`.
6. **Aucun système de crédits/abonnement générique n'existe** au-delà de `credits_revision` (v2, solde unique) — la grille à 4 formules nécessite une vraie table d'abonnement (`abonnements_base`) distincte des crédits, jamais une même table pour deux mécanismes de facturation différents (récurrent vs. à l'usage).

## Décision structurante — ordre des lots

Ordre suggéré par le document maître respecté, adapté à ce qui existe déjà :

- **Lot F** — Design tokens étendus + système des 10 thèmes (`preferences_utilisateur`) — fondation visuelle pour tout le reste.
- **Lot G** — Layout responsive 3 zones (sidebar + centre + panneau vocal) desktop, tiroir hamburger + barre basse (déjà en place, v2) mobile.
- **Lot H** — Modèle économique v2 : `abonnements_base` (200 FCFA/mois, multi-payeur), gate sur le moteur quiz de base, grille à 4 formules, plafonds fair-use.
- **Lot I** — Flashcards (base NLP + avancé mnémotechnique IA + export imprimable).
- **Lot J** — CV autonome : formulaire standard par sections + bouton optionnel de pré-remplissage ICC/IGA (bénéficiaires uniquement).
- **Lot K** — Composants vocaux réutilisables (VoiceInput/AudioPlayer/VoiceConversation/VoiceAssistant, Web Speech API) + intégration Quiz/IGA/ICC/Tuteurs.
- **Lot L** — Fonctionnalités complémentaires base restantes (glossaire personnel, suggestions de parcours, auto-évaluation avant/après) — historique de révision et objectifs existent déjà (v2).

Chaque lot suit la même discipline que v2 : `tsc --noEmit`, tests standalone pour la logique pure, tests SQL RLS pour tout nouveau schéma, smoke Playwright, non-régression complète avant de passer au lot suivant.
