---
name: psychoeduc-boucle
description: Exécute en full autonomie le plan de l'étape courante de PsychoÉduc Manager, en itérant discovery → plan → exécution → vérification jusqu'à ce que chaque tâche passe ses tests, sans demander de validation intermédiaire à Angenor — y compris pour les décisions structurantes, qui sont documentées mais pas bloquantes. Utilise ce skill après psychoeduc-contexte et psychoeduc-plan, dès qu'Angenor dit "lance la boucle", "vas-y en autonome", "je repasse demain matin", ou tout équivalent signalant qu'il ne veut pas être sollicité pendant l'exécution.
---

# Boucle autonome PsychoÉduc Manager

Rôle : exécuter `PLAN_ETAPE_X.md` de bout en bout, tâche par tâche, en itérant jusqu'à validation réelle — sans repasser par Angenor, même en cas de doute sur une décision structurante.

## Cycle par tâche

Pour chaque tâche du plan, dans l'ordre des dépendances :

### 1. Discovery
Relire le code et le schéma existants autour de cette tâche spécifique (pas tout le projet — juste le périmètre concerné) pour éviter les collisions avec ce qui existe déjà. Vérifier que les dépendances déclarées dans le plan sont bien satisfaites.

### 2. Plan (micro-plan d'exécution)
Décider précisément quels fichiers créer/modifier, quelles migrations SQL écrire, dans quel ordre. Si la tâche est marquée "décision structurante" dans le plan : trancher, appliquer, et écrire la justification dans `DECISIONS_LOG.md` (nouveau fichier, append-only) avant de continuer. Ne jamais interrompre l'exécution pour demander confirmation.

### 3. Exécution
Écrire le code / la migration / le composant. Déployer sur le VPS si applicable (DNS, build, restart des services concernés).

### 4. Vérification
Trois niveaux obligatoires, jamais moins :
- **Tests unitaires** sur la logique métier touchée (en particulier tout calcul lié à l'IGA — ces 12 dimensions ne tolèrent pas d'erreur silencieuse)
- **Tests end-to-end navigateur (Playwright)** simulant un utilisateur réel : ouvrir la page, remplir le formulaire, cliquer les boutons, vérifier que la donnée attendue apparaît en base ou à l'écran. Tester aussi les cas d'échec évidents (champ vide, session expirée, rôle non autorisé).
- **Checklist sécurité** (voir section dédiée ci-dessous) — obligatoire pour toute tâche touchant à l'auth, aux données de jeunes/bénéficiaires, aux rôles, ou à l'API. Une tâche qui échoue la checklist sécurité n'est pas "terminée", même si ses tests fonctionnels passent.

## Checklist sécurité (à chaque tâche concernée, pas seulement en fin de nuit)

PsychoÉduc Manager manipule des données sensibles : dossiers de jeunes, évaluations psychologiques (IGA), informations sur des mineurs dans certains cas d'usage. Le mode full autonome ne dispense d'aucun de ces points :

- **RLS Supabase** : toute nouvelle table contenant des données de bénéficiaires/jeunes a une policy RLS active *avant* d'être exposée à l'API, jamais après. Tester explicitement qu'un utilisateur d'un rôle A ne peut pas lire/modifier les données d'un rôle B ou d'une autre structure (test Playwright avec deux comptes différents, pas juste un test "ça marche pour moi").
- **Cloisonnement multi-structure** : si une structure (école, foundation, cabinet) utilise PsychoÉduc Manager, vérifier qu'aucune requête ne peut faire fuiter des données d'une autre structure — c'est le risque numéro un d'un SaaS multi-tenant construit vite.
- **Secrets et clés** : jamais de clé API, service role key Supabase, ou identifiant VPS en dur dans le code commité. Toujours en variables d'environnement, jamais loggées. Si une tâche en génère une nouvelle, vérifier qu'elle n'atterrit pas dans `DECISIONS_LOG.md` ou dans un commit.
- **Validation des entrées** : tout endpoint qui reçoit des données (formulaire IGA, upload, import) valide et assainit côté serveur, jamais confiance dans le seul contrôle côté client.
- **Authentification et sessions** : toute nouvelle route protégée est testée aussi en étant délogué / avec un token expiré, pas seulement en étant connecté.
- **Mineurs** : si une fonctionnalité touche à des données concernant des jeunes mineurs, appliquer par défaut le principe du minimum de données visibles/exportables, et ne jamais introduire de fonctionnalité de partage public ou de lien non authentifié sur ce type de donnée sans que ce soit une décision structurante explicitement tracée et justifiée dans `DECISIONS_LOG.md`.
- **Dépendances** : toute nouvelle librairie ajoutée au projet (npm) est une surface d'attaque potentielle — préférer une librairie déjà utilisée ailleurs dans le projet plutôt qu'en ajouter une nouvelle pour un besoin mineur.

### 5. Itération
Si un test échoue : corriger et revenir à l'étape 3 sans repasser par Angenor. Répéter jusqu'à ce que tous les critères de vérification de la tâche soient au vert. Ne jamais marquer une tâche "terminée" sur la seule base du code écrit — seulement sur la base des tests qui passent.

## Fin de session (fin de nuit)

Quand toutes les tâches du plan sont vertes, ou si un blocage réel et non résoluble seul est atteint (ex. clé API manquante, service externe down) :

1. Mettre à jour `ETAT_PROJET.md` (nouvelle étape réelle, ce qui est fait/vérifié/restant)
2. Résumer `DECISIONS_LOG.md` du jour en 3-5 lignes en haut du fichier
3. Produire un résumé de session lisible en 30 secondes pour Angenor :
   - Ce qui a été livré et testé
   - Les décisions structurantes prises seul, avec justification en une ligne chacune
   - Ce qui bloque, s'il y a un blocage réel

## Garde-fous non négociables, même en mode full autonome

- Ne jamais supprimer de données de production sans backup préalable automatique
- Ne jamais désactiver une RLS policy Supabase sans la remplacer immédiatement par une équivalente
- Ne jamais pousser en production une tâche dont les tests échouent encore, même en fin de session — dans ce cas, la laisser sur une branche et le signaler comme blocage, pas comme livré
- **Ne jamais pousser en production une tâche qui échoue la checklist sécurité, même si tout le reste est vert.** Un échec de sécurité est traité exactement comme un blocage technique : la tâche reste sur une branche, elle est signalée dans le résumé de fin de session, elle n'est pas comptée comme "livrée" dans `ETAT_PROJET.md`.
- Toute décision structurante — y compris et surtout celles qui touchent à l'auth, aux permissions par rôle, ou à la visibilité de données de bénéficiaires — doit être dans `DECISIONS_LOG.md`, sans exception, même si elle semble mineure sur le moment. C'est la seule chose qui permet à Angenor de revenir dessus le lendemain matin en connaissance de cause.
- En cas de doute réel sur une implication sécurité (pas juste une préférence de design) : la boucle continue sur les autres tâches du plan, mais celle-là est marquée "à revoir humainement" plutôt que tranchée seule — c'est la seule exception à la règle du full autonome, parce que la sécurité des données n'est pas une décision produit réversible comme les autres.
