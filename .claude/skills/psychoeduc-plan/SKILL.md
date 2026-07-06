---
name: psychoeduc-plan
description: Découpe l'étape courante des 21 étapes de PsychoÉduc Manager en tâches concrètes, ordonnées et vérifiables, avec critères de test explicites pour chacune. Utilise ce skill juste après psychoeduc-contexte, dès qu'il faut avancer sur une étape (config Supabase, module IGA, dashboard, authentification, etc.), ou quand Angenor dit "attaque l'étape suivante", "on continue", "planifie ça". Ne jamais exécuter de code avant d'être passé par ce skill.
---

# Plan d'étape PsychoÉduc Manager

Rôle : transformer une étape vague ("étape 5 : config Supabase") en une liste de tâches exécutables et testables automatiquement, pour permettre à psychoeduc-boucle de travailler sans repasser par Angenor.

## Processus

1. **Prendre l'étape courante** telle que déterminée par psychoeduc-contexte (`ETAT_PROJET.md`).

2. **Croiser avec le document d'architecture v4.0** pour lister exhaustivement ce que cette étape doit produire :
   - tables Supabase concernées (schéma, relations, RLS policies)
   - endpoints Node.js concernés
   - composants Vue.js concernés
   - impact éventuel sur l'IGA (12 dimensions) si l'étape le touche

3. **Découper en tâches atomiques**, chacune avec :
   - **Objectif** : une phrase, un résultat observable
   - **Dépendances** : quelles tâches doivent être finies avant
   - **Critère de vérification automatisable** : comment psychoeduc-boucle saura que c'est fait sans demander à Angenor
     - ex. "la table `iga_scores` existe avec les 12 colonnes de dimension, RLS activée, testable par une requête SELECT authentifiée"
     - ex. "le formulaire d'évaluation IGA soumet et la ligne apparaît en base, testable par un test Playwright end-to-end"
   - **Risque de décision structurante** : si la tâche touche au schéma de données central, à l'auth, ou à l'architecture multi-rôles → la signaler comme telle dans le plan (voir note plus bas), mais ne pas bloquer dessus.

4. **Écrire le plan dans un fichier** `PLAN_ETAPE_X.md`, à côté de `ETAT_PROJET.md`, dans l'ordre d'exécution.

## Checklist de durabilité architecturale (à vérifier pour chaque tâche du plan)

PsychoÉduc Manager vise à durer des décennies, pas juste à sortir une V1. Chaque tâche du plan doit être compatible avec ces 7 principes — une tâche qui les viole doit être reformulée avant d'entrer dans le plan :

1. **Versionner le référentiel IGA** : toute tâche qui touche aux dimensions, critères ou barèmes IGA doit inclure un `version_referentiel_iga` sur les évaluations concernées, pour que les scores historiques restent comparables même après une évolution du référentiel.
2. **Cloisonnement multi-organisations testé systématiquement** : toute tâche créant ou modifiant une table liée aux bénéficiaires doit inclure un test automatisé de fuite inter-organisations (deux comptes, deux structures), pas une vérification ponctuelle.
3. **Logique métier découplée du fournisseur cloud** : les calculs IGA, règles financières et logique métier critique s'écrivent en TypeScript/JavaScript standard, pas en fonctions propriétaires Supabase profondément imbriquées.
4. **Argent en registre append-only** : toute tâche touchant `paiements`, `wallets`, `commissions` ou équivalent ajoute une nouvelle ligne pour tout changement d'état — jamais de mise à jour en place qui efface l'historique.
5. **Documentation de transmissibilité** : toute décision structurante prise dans `DECISIONS_LOG.md` doit rester compréhensible par quelqu'un qui n'a pas suivi le projet en temps réel — pas de raccourcis tacites.
6. **Anticiper la conformité données sensibles** : toute tâche touchant aux données de mineurs applique par défaut le principe du minimum de données visibles/exportables, même si rien ne l'exige encore formellement aujourd'hui.
7. **Migrations additives uniquement** : aucune tâche ne doit produire une migration destructive (colonne supprimée, table renommée sans étape de transition) — toujours ajouter puis déprécier progressivement, jamais casser d'un coup.

## Note sur l'autonomie

Angenor a choisi le mode **full autonome** : psychoeduc-boucle ne doit pas s'arrêter pour valider les décisions structurantes en cours de nuit. Ce skill doit donc, pour toute tâche à fort impact (migration destructive, changement de schéma d'auth, suppression de table), **documenter le raisonnement et l'alternative écartée directement dans le plan**, pour que la trace existe et soit relisible le lendemain matin — la vérification humaine se fait a posteriori, pas en bloquant l'exécution.

## Règle de sortie

Un plan n'est valide que si chaque tâche a un critère de vérification automatisable. Une tâche sans critère de test clair doit être reformulée ou scindée avant d'être ajoutée au plan — sinon psychoeduc-boucle n'aura aucun moyen de savoir si elle est réellement terminée.
