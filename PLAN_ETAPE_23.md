# Plan — Étape 23 : Statistiques mondiales & dashboards

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 25. Enrichit `vue_dashboard_fondateur` déjà créée ("18 light") plutôt que de la recréer. `top100_iga` (Étape 9) satisfait déjà `vue_top100_iga` du document — alias créé pour respecter le nom exact, sans dupliquer la logique. `vue_soldes_actuels` déjà construite (Étape 14).

## Décision structurante
**Toutes les vues sont `security_invoker`, aucune RLS supplémentaire dessus** : elles agrègent des données déjà filtrées par le RLS des tables sous-jacentes. Conséquence naturelle et voulue : le fondateur voit des totaux plateforme, un membre de staff voit des totaux restreints à sa propre organisation via la même vue, sans logique supplémentaire à écrire.

## Tâches
### T1 — Enrichissement de `vue_dashboard_fondateur`
`CREATE OR REPLACE VIEW` (additif) : ajoute total structures/employeurs/solo, total personnel, revenus confirmés totaux, total réussites confirmées — en plus des 6 métriques déjà présentes.

### T2 — Nouvelles vues de synthèse
`vue_dashboard_modules` (organisations actives par module), `vue_carte_implantation` (implantations par pays/ville), `vue_revenus` (paiements confirmés par mois), `vue_top100_iga` (alias sur `top100_iga`), `vue_insertion` (insertions par statut/type), `vue_support` (tickets par statut/priorité), `vue_reussites` (réussites **confirmées uniquement**, conformément à la règle "pas de gonflement artificiel des chiffres"), `vue_marketplace` (offres par statut + commission totale confirmée).

### T3 — `statistiques_plateforme`, `configurations_dashboard`
- `statistiques_plateforme(id, cle text, valeur jsonb, calcule_le timestamptz default now())` — table de snapshots périodiques, alimentée par une tâche future (pas de calcul synthétique inventé ce soir).
- `configurations_dashboard(id, profile_id FK unique, valeur jsonb, updated_at)` — préférences d'affichage par utilisateur.

### T4 — RLS + test (obligatoire)
`statistiques_plateforme` : lecture fondateur/staff habilité, écriture fondateur. `configurations_dashboard` : chacun gère uniquement la sienne. Vérification : `vue_reussites` ne contient que les réussites confirmées (pas les proposées) ; un staff non-fondateur interrogeant `vue_dashboard_fondateur` ne voit que les totaux de sa propre organisation, pas la plateforme entière.

### T5 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4→T5
