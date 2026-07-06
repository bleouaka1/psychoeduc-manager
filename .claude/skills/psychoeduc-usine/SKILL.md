---
name: psychoeduc-usine
description: Orchestre automatiquement l'enchaînement complet des étapes restantes de construction de PsychoÉduc Manager (contexte → plan → boucle, répété étape après étape jusqu'à l'étape 21 ou jusqu'à blocage réel), sans qu'Angenor ait à relancer la commande à chaque étape. Utilise ce skill quand Angenor dit "construis tout", "je veux que tout soit automatique", "enchaîne les étapes", ou tout équivalent signalant qu'il veut lancer une session de construction longue et repartir plusieurs heures sans intervenir. Ce skill appelle les skills psychoeduc-contexte, psychoeduc-plan et psychoeduc-boucle en séquence répétée — il ne les remplace pas.
---

# Usine PsychoÉduc Manager — orchestrateur multi-étapes

Rôle : transformer "une étape à la fois, relancée à la main" en "toutes les étapes restantes, enchaînées seules jusqu'à la fin ou jusqu'à un vrai mur".

## Cycle global

```
TANT QUE étape_courante <= 21 :
    1. Appliquer psychoeduc-contexte
       → détermine l'étape réelle, pas l'étape déclarée
    2. Appliquer psychoeduc-plan sur cette étape
       → découpe en tâches vérifiables
    3. Appliquer psychoeduc-boucle sur ce plan
       → discovery/exec/vérif jusqu'à tâches vertes, checklist sécurité incluse
    4. SI toutes les tâches de l'étape sont vertes ET la checklist sécurité est passée :
       - marquer l'étape comme close dans ETAT_PROJET.md
       - étape_courante += 1
       - passer directement à l'étape suivante, sans repasser par Angenor
    5. SINON SI blocage réel (dépendance externe manquante, ex. clé API absente,
       accès WhatsApp Business non obtenu, décision sécurité marquée "à revoir
       humainement") :
       - arrêter l'usine à cette étape précise
       - écrire un blocage clair dans ETAT_PROJET.md
       - NE PAS sauter l'étape ni continuer sur la suivante en la laissant à moitié faite
```

## Ce qui justifie un arrêt de l'usine (liste fermée)

L'usine ne s'arrête que pour des raisons réelles, jamais par prudence excessive :

- Une dépendance externe non disponible (ex. Étape 15 nécessite l'accès WhatsApp Business API — si non obtenu, l'usine saute cette étape spécifique, la marque "en attente d'accès externe", et continue sur les étapes suivantes qui n'en dépendent pas)
- Un point de sécurité marqué "à revoir humainement" par psychoeduc-boucle (cf. son garde-fou sécurité — c'est la seule exception documentée au full autonome)
- Une divergence détectée par psychoeduc-contexte entre l'état déclaré et l'état réel du projet, trop importante pour être résolue seule (ex. des tables existent en base mais ne correspondent à aucune étape connue)
- Une limite technique du VPS (espace disque, mémoire) empêchant un déploiement

Tout le reste — choix de nommage, structure de composant, ordre de sous-tâches, décisions structurantes non liées à la sécurité — est tranché seul et tracé dans `DECISIONS_LOG.md`, conformément à psychoeduc-boucle.

## Réordonnancement V1

Angenor vise une V1 minimale (bénéficiaires + IGA + dashboard léger) avant le reste. Par défaut, l'usine suit donc cet ordre plutôt que l'ordre strictement numérique du document d'architecture :

```
1 → 2 → 3 → 4 → 5 (bénéficiaires) → 9 (IGA) → 18 light (dashboard minimal)
puis reprise de l'ordre standard pour le reste : 6 → 7 → 8 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 19 → 20 → 21
```

Cet ordre est appliqué automatiquement sauf instruction contraire d'Angenor en début de session.

## Rapport de fin d'usine (à chaque arrêt, qu'il soit normal ou sur blocage)

Un seul résumé, lisible en 30 secondes, écrit en haut de `ETAT_PROJET.md` :

- Étapes closes cette session (numéro + nom)
- Étape où l'usine s'est arrêtée et pourquoi
- Décisions structurantes prises seul (renvoi vers `DECISIONS_LOG.md` pour le détail)
- Ce qu'Angenor doit faire pour débloquer, s'il y a blocage (ex. "obtenir l'accès WhatsApp Business avant que l'Étape 15 puisse être reprise")

## Ce que ce skill ne rend pas automatique

- L'obtention initiale d'accès externes (compte passerelle de paiement, WhatsApp Business API) reste une démarche humaine, une fois — l'usine ne peut pas remplir un formulaire d'approbation à ta place
- Les points de sécurité marqués "à revoir humainement" restent des points d'arrêt volontaires, pas des bugs de l'orchestrateur
- La validation finale que le produit correspond à ta vision reste la tienne — l'usine construit et vérifie techniquement, elle ne juge pas si le produit final répond au marché
