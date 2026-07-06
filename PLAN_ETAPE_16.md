# Plan — Étape 16 : Marketplace

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 18.

## Décision structurante
**Construction anticipée minimale de `parametres_plateforme`** (normalement Étape 25) : le document exige explicitement "le taux vit dans parametres_plateforme (configurable sans redéploiement), pas codé en dur" pour la commission marketplace — et la même exigence revient à l'Étape 17 (Événements, même taux). Plutôt que coder 0.15 en dur dans deux migrations puis devoir les corriger à l'Étape 25, je construis dès maintenant une version minimale de `parametres_plateforme` (clé/valeur JSON) + une fonction `get_parametre_numerique(cle, defaut)`. L'Étape 25 l'enrichira (autres paramètres), sans renommage ni migration destructive.

## Tâches
### T1 — `parametres_plateforme` (minimal, anticipé) + fonction d'accès
`parametres_plateforme(id, cle text unique not null, valeur jsonb not null, description text, updated_at)`. Seed : `taux_commission_marketplace = 0.15`. Fonction `get_parametre_numerique(p_cle text, p_defaut numeric) returns numeric` (fallback sur `p_defaut` si la clé n'existe pas).

### T2 — `marketplace_categories`, `marketplace_offres`
- `marketplace_categories(id, nom text not null, type_offre text, description text, created_at, updated_at)`.
- `marketplace_offres(id, vendeur_type text check(organisation/solo), vendeur_id uuid, type_offre text check(formation/service/produit), titre text not null, description text, prix numeric, devise text default 'FCFA', statut text check(en_attente_validation/publiee/refusee/masquee/retiree) default 'en_attente_validation', valide_par FK profiles, date_validation timestamptz, nombre_signalements int default 0, organisation_id FK, created_by, created_at, updated_at)`.

### T3 — `marketplace_commandes` (append-only), `marketplace_avis`, `marketplace_signalements`
- `marketplace_commandes(id, offre_id FK, acheteur_id FK profiles, montant_brut numeric not null, taux_commission numeric default get_parametre_numerique(...), montant_commission numeric, montant_vendeur numeric, statut_paiement text check(initie/confirme/echoue/rembourse) default 'initie', mouvement_financier_id FK nullable, date_commande timestamptz default now(), organisation_id FK, created_at)`. Append-only.
- `marketplace_avis(id, offre_id FK, acheteur_id FK profiles, note int check(1-5), commentaire text, visible boolean default true, created_at)`.
- `marketplace_signalements(id, offre_id FK, signale_par FK profiles, motif text, statut text check(en_attente/traite) default 'en_attente', created_at, updated_at)`.

### T4 — Trigger de masquage automatique
Trigger AFTER INSERT sur `marketplace_signalements` : incrémente `nombre_signalements` sur l'offre, passe `statut = 'masquee'` si le seuil (3, valeur par défaut documentée, ajustable plus tard via `parametres_plateforme`) est atteint.

### T5 — Index, seed permissions, RLS + test (obligatoire)
Vérification : une offre en `en_attente_validation` n'est pas visible aux acheteurs (RLS) tant que non validée ; 3 signalements masquent automatiquement l'offre ; cloisonnement (2 organisations) ; append-only vérifié sur `marketplace_commandes`.

### T6 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4→T5→T6
