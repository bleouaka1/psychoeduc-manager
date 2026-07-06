# Plan — Étape 15 : Registre financier append-only

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 17. **Construite avant l'Étape 14** (réordonnancement décidé, voir `DECISIONS_LOG.md`) : `wallets_beneficiaires` de l'Étape 14 doit être une vue calculée sur `mouvements_financiers`, qui doit donc exister d'abord.

## Décision structurante : réconciliation avec `transactions_wallet` (Étape 2)
`transactions_wallet` (créée à l'Étape 2, avant que `mouvements_financiers` existe) reste en place — aucune donnée supprimée, aucune table renommée. `wallet_fondateur` (vue) est mise à jour pour sommer **les deux** registres (`UNION ALL` entre `transactions_wallet` historique et les futures lignes `mouvements_financiers` où `beneficiaire_id is null`, représentant les mouvements plateforme). Toute nouvelle écriture de mouvement fondateur ira désormais dans `mouvements_financiers`, `transactions_wallet` devient un registre historique gelé (plus jamais alimenté, mais jamais supprimé).

## Tâches
### T1 — `mouvements_financiers`
`mouvements_financiers(id uuid PK, organisation_id uuid FK nullable, beneficiaire_id uuid FK nullable, type_mouvement text, montant numeric not null, devise text default 'FCFA', reference_source_table text, reference_source_id uuid, statut text check(confirme/annule) default 'confirme', created_by, created_at)`. Append-only strict : RLS interdit UPDATE et DELETE, seuls INSERT et SELECT autorisés.

### T2 — Réconciliation `wallet_fondateur`
`CREATE OR REPLACE VIEW wallet_fondateur` : `UNION ALL` entre `transactions_wallet` (historique, statut confirme) et `mouvements_financiers` (organisation_id is null et beneficiaire_id is null, statut confirme). Vérifié par test : le solde reste correct après réconciliation (pas de perte des données historiques de l'Étape 2).

### T3 — Index, RLS + test (obligatoire)
RLS : SELECT scopé par organisation/bénéficiaire ou fondateur ; **aucune policy UPDATE/DELETE**, pour personne, jamais — même le fondateur. Vérification : append-only vérifié explicitement, cloisonnement testé (2 organisations).

### T4 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4
