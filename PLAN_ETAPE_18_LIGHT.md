# Plan — Étape 18 (light) : Dashboard minimal

Contexte : dernière étape du socle V1 avant de reprendre l'ordre standard (6, 7, 8, 10...). Objectif : rendre la mission visible (compter ce qui existe réellement dans la nouvelle base v5), pas construire le dashboard complet de l'Étape 23 (`vue_dashboard_fondateur` complet, `vue_carte_implantation`, etc.) qui viendra plus tard avec plus de métriques.

## Décision de périmètre (à ne pas dépasser ce soir)
Aucune des 21 étapes nommées de l'architecture v5 ne couvre explicitement "construire l'écran de connexion" — les étapes sont centrées sur le schéma de données, pas les écrans d'authentification. Construire une UI de connexion complète (Supabase Auth UI, sessions, middleware de routes protégées) est un chantier frontend à part entière, plus gros qu'un "dashboard léger". Décision : ce soir, on construit uniquement la vue de synthèse + la page qui l'affiche, honnêtement en lecture seule via la clé anonyme (donc 0 partout tant que personne n'est connecté — comportement RLS correct, pas un bug). Le chantier "connexion" est noté comme non traité dans `ETAT_PROJET.md`, pas bloquant pour la suite de l'usine.

## Tâches

### T1 — Vue `vue_dashboard_fondateur` (version légère)
**Objectif** : vue `security_invoker` agrégeant : `total_organisations`, `total_beneficiaires`, `total_evaluations_iga`, `score_iga_moyen`, `licences_actives`, `essais_gratuits_en_cours`. Nom réutilisé tel quel — l'Étape 23 l'enrichira plus tard (migration additive, `CREATE OR REPLACE VIEW`), pas de renommage.
**Vérification** : la vue retourne une ligne unique ; en tant que fondateur, les compteurs reflètent les données réelles ; en tant qu'anonyme, RLS renvoie 0 partout (pas une erreur).

### T2 — Nettoyage `lib/supabase.ts`
**Objectif** : corriger le nom de fichier fauté (`lib/supabase. ts` → `lib/supabase.ts`) et le contenu dupliqué. Déjà fait en amont de ce plan (petite dette technique, pas une tâche complexe).
**Vérification** : un seul fichier `lib/supabase.ts`, import propre, un seul client exporté.

### T3 — Réécriture de `app/page.tsx`
**Objectif** : Server Component qui interroge `vue_dashboard_fondateur` via le client `lib/supabase.ts` (au lieu d'un client dupliqué local) et affiche les 6 métriques réelles. Suppression des sections "Comptes Solo" et "Pays / Ministères" comme entités séparées (abandonné depuis la v4/v5 — le document est explicite). Conserve un état "0 partout" propre si `data` est vide (pas authentifié), sans message d'erreur alarmant.
**Vérification** : `npm run dev` démarre sans erreur ; la page se charge et affiche les 6 cartes de métriques (à 0 si non authentifié, ce qui est le comportement RLS correct).

### T4 — Test end-to-end minimal (Playwright)
**Objectif** : test qui démarre le serveur, ouvre la page, vérifie que le titre "PsychoÉduc Manager" et les 6 cartes de métriques sont bien présents à l'écran, sans erreur JavaScript non gérée.
**Vérification** : test Playwright vert.

### T5 — Clôture d'étape
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`, notant explicitement que l'authentification (login/session) reste à construire séparément.

## Ordre d'exécution
T1 → T2 (déjà fait) → T3 → T4 → T5
