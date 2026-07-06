---
name: psychoeduc-contexte
description: Recharge systématiquement l'état complet du projet PsychoÉduc Manager (architecture v4.0, 70+ tables, 21 étapes de construction, stack Next.js/React/TypeScript/Supabase, outil IGA) avant toute intervention. Utilise ce skill en tout début de session de travail sur PsychoÉduc Manager, avant de lancer psychoeduc-plan ou psychoeduc-boucle, ou dès qu'Angenor mentionne "où j'en suis", "reprends le projet", "PsychoÉduc Manager", ou une étape numérotée. Sans ce skill, toute décision prise sur le projet risque de casser la cohérence de l'architecture globale.
---

# Contexte PsychoÉduc Manager

Rôle : reconstruire l'état réel du projet avant d'agir, jamais supposer.

## Ce que ce skill doit faire, dans l'ordre

1. **Localiser et lire les documents d'architecture** (dans le repo ou le Project) :
   - le document d'architecture v4.0 (les 70+ tables, les 21 étapes)
   - le dernier fichier d'état / changelog s'il existe (`ETAT_PROJET.md` — voir plus bas, ce skill doit le créer s'il n'existe pas)
   - le schéma Supabase actuel (`supabase/migrations/` ou export SQL)
   - le code source existant (structure des dossiers Next.js/React/TypeScript, dossiers `app/`, `lib/`)
   - les fichiers `AGENTS.md` et `CLAUDE.md` déjà présents à la racine du projet

2. **Déterminer l'étape réelle**, pas l'étape déclarée. Croiser :
   - ce que dit le dernier `ETAT_PROJET.md`
   - ce qui existe réellement en base (tables créées vs tables prévues à cette étape)
   - ce qui existe réellement dans le code (composants, routes, endpoints)
   
   Si divergence entre "ce qui est dit" et "ce qui existe" → signaler explicitement avant de continuer. Ne jamais repartir sur une hypothèse fausse.

3. **Produire un résumé de contexte** (affiché à Angenor, pas seulement en mémoire) :
   - Étape actuelle réelle / 21
   - Ce qui est fait et vérifié fonctionnel
   - Ce qui est fait mais non testé
   - Ce qui reste à faire pour clore l'étape en cours
   - Tout blocage ou dette technique connue

## Fichier d'état : `ETAT_PROJET.md`

Ce skill maintient un fichier unique à la racine du repo, mis à jour à chaque fin de session (par psychoeduc-boucle) :

```markdown
# État PsychoÉduc Manager — dernière mise à jour : [date]

## Étape actuelle : X / 21
[nom de l'étape]

## Fait et vérifié
- ...

## Fait, non vérifié
- ...

## Reste à faire pour clore l'étape
- ...

## Décisions structurantes prises cette session
- ...

## Dette technique / points de vigilance
- ...
```

Si ce fichier n'existe pas encore, le créer à partir de l'audit du code + de la base + de l'historique de conversation disponible, puis le signaler à Angenor pour validation une seule fois (c'est la seule étape qui mérite une validation manuelle, car elle fixe la vérité de référence pour tout le reste).

## Règle de sortie

Ne jamais passer à psychoeduc-plan ou psychoeduc-boucle tant que ce résumé de contexte n'a pas été produit dans la session en cours. Un contexte périmé est pire qu'une absence de contexte.
