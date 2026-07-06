# Plan — Étape 17 : Événements

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 19. Réutilise `parametres_plateforme`/`get_parametre_numerique` de l'Étape 16 pour le taux de commission (même mécanisme, explicitement demandé par le document).

## Décision structurante
**`evenements_inscriptions` en append-only**, même pattern que `marketplace_commandes` : une inscription payante est structurellement une commande, tout changement de statut de paiement doit rester traçable sans écrasement.

## Tâches
### T1 — `evenements`
`evenements(id, createur_type text check(fondateur/organisation/solo), createur_id uuid, titre text not null, description text, type_evenement text check(gratuit/payant), prix numeric, devise text default 'FCFA', date_debut timestamptz, date_fin timestamptz, lieu_type text check(physique/en_ligne), lieu_details text, capacite_max int, places_restantes int, statut text check(en_attente_validation/publie/refuse/annule/termine) default 'en_attente_validation', valide_par FK profiles, date_validation timestamptz, organisation_id FK, created_by, updated_by, created_at, updated_at)`.
Trigger : si `createur_type='fondateur'` → `statut='publie'` directement à l'insertion, sinon `en_attente_validation` (même file que la marketplace) ; transition ultérieure vers `publie`/`refuse` réservée au fondateur.

### T2 — `evenements_inscriptions` (append-only), `evenements_rappels`
- `evenements_inscriptions(id, evenement_id FK, participant_id FK profiles, statut_paiement text check(non_requis/initie/confirme/echoue/rembourse) default 'non_requis', montant_paye numeric, mouvement_financier_id FK nullable, date_inscription timestamptz default now())`.
- `evenements_rappels(id, evenement_id FK, canal text check(whatsapp/email), envoye_le timestamptz default now())`.

### T3 — Index, seed permissions, RLS + test (obligatoire)
Vérification : création par le fondateur → publié directement ; création par un non-fondateur → en_attente_validation, auto-validation bloquée ; cloisonnement (2 organisations) ; append-only sur `evenements_inscriptions`.

### T4 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4
