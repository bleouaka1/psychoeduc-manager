# Plan — IGA multi-référentiel (IGA-E, IGA-A, IGA-J, IGA-AD)

Réf : `IGA_Philosophie_Vision_Globale.md`, `IGA-J_Fiche_Mesure_v1.md`, `IGA_Fiches_Completes_E_A_AD.md`.
Mode autonome (« travaille maintenant ») : décisions structurantes documentées ci-dessous, non bloquantes.

## Constat schéma existant (Étape 9)

- `referentiels_iga` : un seul actif à la fois (index unique partiel `where actif=true`) — pensé pour des
  versions SUCCESSIVES d'un même instrument, pas pour 4 instruments PARALLÈLES actifs simultanément.
  **Décision : relâcher cette contrainte.** `actif` devient juste un statut d'affichage/disponibilité par
  référentiel, plus une contrainte d'unicité globale — les 4 lignes (E/A/J/AD) sont actives en même temps.
- `dimensions_iga`/`criteres_iga` déjà scopés par `referentiel_id`/`dimension_id` — aucune structure à
  changer, juste de nouvelles lignes par référentiel.
- `criteres_iga` n'a pas de colonne pour le texte littéral des 5 points d'échelle (0/1/2/3/4) — **ajout
  additif `echelle jsonb`** (`{"0": "...", "1": "...", ...}`), obligatoire pour respecter la consigne
  explicite des fiches ("formulation complète, pas de raccourci").
- `indicateurs_iga.note_sur_20` suppose une normalisation fixe à 20 points — les nouvelles grilles ont des
  poids de critère variables (/3 à /8). **Décision : ajouter `score_brut int check (between 0 and 4)`
  additif**, `note_sur_20` reste calculable a posteriori (`score_brut / 4 * poids_critere`) mais n'est plus
  la source de vérité — le score brut 0-4 saisi par le praticien l'est.
- `evaluations_iga.niveau` a déjà un enum 5 valeurs (`dependance`, `autonomie_emergente`,
  `autonomie_fonctionnelle`, `autonomie_avancee`, `leadership_autonome`) — libellés différents de la
  nouvelle grille commune ("Dépendance critique"..."Autonomie élevée") mais **même structure à 5 paliers de
  20 points**. Décision : réutiliser l'enum existant tel quel (juste un remapping d'affichage
  côté UI, `NIVEAU_LABEL`), pas de migration destructive du enum pour un simple changement de libellé.
- Aucune UI de PRISE d'évaluation n'existe encore (`evaluations_iga`/`dimensions_iga` ne sont lus que pour
  affichage de stats) — c'est un nouveau formulaire à construire de zéro, pas une extension.
- `beneficiaires.date_naissance` + `calculer_age()` déjà en place (Étape 5) — suffisant pour suggérer le
  référentiel par défaut selon l'âge.

## Décision : résolution du chevauchement 18-25 (IGA-A vs IGA-J)

Pas de règle automatique fragile sur un champ scolarisé/inséré qui n'existe pas de façon fiable en base.
**Le référentiel est suggéré selon l'âge (0-12→E, 13-17→A, 18-35→J par défaut, 35+→AD) mais toujours
modifiable par le praticien via un sélecteur au moment de créer l'évaluation** — cohérent avec le principe
« le logiciel facilite, il ne se substitue pas au jugement professionnel » (Philosophie §6).

## Décision : IGA-A pas encore reçu en détail (seulement un résumé par dimension)

Rédigé par Claude Code sur le modèle littéral exact d'IGA-E/J/AD (échelle 0-4 explicite par critère, à
partir des descriptions sommaires déjà fournies), **soumis à validation d'Angenor avant que ce module
spécifique soit considéré définitif** — E, J, AD n'attendent pas cette validation pour avancer.

## Tâches

### T1 — Migration schéma (additive)
`organisations`... non — `criteres_iga.echelle jsonb`, `indicateurs_iga.score_brut int`, relâchement de la
contrainte unique sur `referentiels_iga.actif`, seed des 4 référentiels (E/A/J/AD) + leurs dimensions +
critères avec échelle littérale complète.
**Vérification** : script SQL confirmant les 4 référentiels actifs simultanément, chaque dimension/critère
avec son `echelle` renseigné, non-régression sur le référentiel v1 existant (12 dimensions inchangées).

### T2 — `lib/iga.ts` : suggestion de référentiel + calcul de score (TypeScript standard)
`suggererReferentiel(dateNaissance)`, `calculerScoreEvaluation(indicateurs)` — logique métier découplée du
fournisseur cloud, testable sans base de données (principe absolu du projet).
**Vérification** : script Node ad hoc (suggestion correcte aux bornes d'âge, calcul pondéré correct sur un
jeu d'indicateurs de test).

### T3 — Formulaire de prise d'évaluation
Nouvelle page `/solo/beneficiaires/[id]/evaluations/nouvelle` : sélection du référentiel (suggéré,
modifiable), formulaire dynamique par dimension/critère (radio 0-4 avec le texte littéral complet affiché),
calcul et sauvegarde (`evaluations_iga` + `scores_iga` + `indicateurs_iga`), sortie attendue conforme à la
spec (score/niveau, dimensions fortes/faibles, pistes d'action par dimension faible → `recommandations_iga`
existante).
**Vérification** : test Playwright de bout en bout (créer une évaluation IGA-J complète, score global
correct affiché, dimensions fortes/faibles identifiées).

### T4 — Affichage sur la fiche bénéficiaire
Historique IGA déjà présent sur la fiche (`evaluations_iga` lu) — étendre pour indiquer quel référentiel a
été utilisé par évaluation (utile dès qu'un bénéficiaire change de tranche d'âge dans le temps).
**Vérification** : Playwright, l'historique affiche le bon libellé de référentiel par évaluation.

### T5 — Tests + clôture
Suite complète rejouée, `ETAT_PROJET.md`/`DECISIONS_LOG.md` mis à jour, `tsc --noEmit` propre.

## Ordre d'exécution
T1 → T2 → T3 → T4 → T5, IGA-A soumis à validation en parallèle sans bloquer E/J/AD.
