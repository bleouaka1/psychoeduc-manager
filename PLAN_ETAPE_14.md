# Plan — Étape 14 : Financement participatif

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 16. Construite après l'Étape 15 (réordonnancement, `mouvements_financiers` doit exister).

## Décisions structurantes
1. **`wallets_beneficiaires` est une vue**, jamais une table stockée — somme des `mouvements_financiers` confirmés par bénéficiaire. Même principe que `wallet_fondateur`.
2. **`vue_soldes_actuels` unifie fondateur + bénéficiaires** en une seule vue (`UNION ALL`), pour un panorama unique de tous les soldes de la plateforme.
3. **`contributions_financement`/`commissions_financement`/`retraits_financement` en append-only strict** (mouvements d'argent réels) — mêmes garde-fous que `paiements`/`revenus_agr`.
4. **Pas de trigger automatique reliant `contributions_financement` à `mouvements_financiers`** : l'orchestration (créditer le bénéficiaire, prélever la commission) est une logique métier qui s'écrira en TypeScript applicatif, pas en fonction Postgres imbriquée (principe absolu section 2). Le schéma fournit les tables et la FK `mouvement_financier_id` pour tracer le lien une fois que cette logique existera côté application.

## Tâches
### T1 — `projets_financement`, `preuves_utilisation_fonds`, `rapports_financement`
- `projets_financement(id, beneficiaire_id FK, organisation_id FK, titre text not null, description text, montant_cible numeric not null, date_debut date default current_date, date_fin date, statut text check(en_cours/finance/cloture/annule) default 'en_cours', created_by, updated_by, created_at, updated_at)`.
- `preuves_utilisation_fonds(id, projet_id FK, organisation_id FK, description text, url_fichier text, montant_justifie numeric, date_soumission date default current_date, valide boolean default false, valide_par FK profiles, created_by, updated_by, created_at, updated_at)`.
- `rapports_financement(id, projet_id FK, organisation_id FK, contenu text, periode_debut date, periode_fin date, redige_par FK profiles, created_by, updated_by, created_at, updated_at)`.

### T2 — `contributions_financement`, `commissions_financement`, `retraits_financement` (append-only)
- `contributions_financement(id, projet_id FK, organisation_id FK, contributeur_id uuid FK profiles nullable, contributeur_nom text, montant numeric not null, devise text default 'FCFA', statut text check(initie/confirme/echoue/rembourse) default 'initie', mouvement_financier_id FK nullable, created_by, created_at)`.
- `commissions_financement(id, contribution_id FK, organisation_id FK, taux_commission numeric, montant_commission numeric, mouvement_financier_id FK nullable, created_at)`.
- `retraits_financement(id, projet_id FK, beneficiaire_id FK, organisation_id FK, montant numeric not null, statut text check(demande/traite/rejete) default 'demande', mouvement_financier_id FK nullable, created_by, created_at)`.

### T3 — Vues `wallets_beneficiaires`, `vue_soldes_actuels`
- `wallets_beneficiaires` : vue `security_invoker`, solde par `beneficiaire_id` depuis `mouvements_financiers` (statut confirme).
- `vue_soldes_actuels` : `UNION ALL` d'une ligne fondateur (depuis `wallet_fondateur`) et de toutes les lignes `wallets_beneficiaires`.

### T4 — Index, triggers (tables mutables uniquement), seed permissions, RLS + test (obligatoire)
Vérification : cloisonnement (2 organisations) ; append-only vérifié sur les 3 tables financières ; les vues reflètent correctement la somme des mouvements.

### T5 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4→T5
