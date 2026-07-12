# Plan — Comptes à profils multiples + Tableau de bord bénéficiaire

Réf : `CLAUDE-CODE-COMPTES-MULTIPROFILS.md`, `CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md` (statut "Validé pour implémentation").
Mode autonome, décisions documentées et non bloquantes (cf. `feedback_default_full_autonomy`).

## Constat de départ — beaucoup plus de fondations déjà en place que prévu

Avant de construire quoi que ce soit, audit du schéma existant (aucune ligne de code n'exploite ces éléments à ce
jour, mais ils existent déjà et évitent une bonne partie du travail que ces deux documents semblent présupposer) :

- **`beneficiaires.profile_id`** (Étape 5) est déjà une colonne nullable vers `profiles(id)`, et **la policy
  `beneficiaires_select` autorise déjà `profile_id = auth.uid()`** — un bénéficiaire peut donc déjà, structurellement,
  avoir son propre compte et voir sa propre fiche, sans qu'aucun code n'exploite ce chemin jusqu'ici. C'est LA
  fondation de tout ce plan : jamais construit, mais jamais en contradiction avec l'existant non plus.
- **`invitations_utilisateurs`** (Étape 4) existe déjà : `organisation_id`, `email`, `role_propose` (incluant déjà
  `'beneficiaire'`), `token` unique, `expire_le`, `statut`. **Zéro ligne de code ne l'utilise nulle part** — c'est un
  schéma mort depuis sa création. Réutilisé ici tel quel plutôt que dupliqué (extension additive : une colonne
  `beneficiaire_id` nullable, pour pointer vers la fiche précise à rattacher à l'acceptation).
- **`projets_vie`** (Étape 7) existe déjà, mais avec `beneficiaire_id uuid not null unique` — **1:1 strict**,
  incompatible avec l'exigence "plusieurs projets de vie actifs en parallèle" du nouveau document. Aucune ligne
  n'existe en base à ce jour (table jamais consommée par le code) : retirer la contrainte `unique` est donc une
  migration additive sans risque de perte de données, pas un changement destructif sur des données réelles.
- **`objectifs_beneficiaire`** (statuts a_venir/en_cours/atteint) et **`entretiens`** (bloc `donnees` jsonb libre,
  déjà utilisé par les fiches Général/Spécialisé) sont les événements réels déclencheurs du fil d'activité "Projet
  de vie" — pas de nouvelle table d'événements à créer, juste une lecture croisée.
- **Collision de nom "capital social" confirmée** : le module Étape 11 (`evaluations_capital_social`,
  `reseau_soutien`, page `/capital-social`) est une vue **praticien** d'un score évalué manuellement — sans rapport
  avec le "Mon capital social" bénéficiaire-facing du nouveau document (réseau de relations confirmées
  mutuellement). Nouvelles tables sous un nom distinct (`relations_capital_social`), l'ancien module n'est pas
  touché.
- **Radar IGA à "8 dimensions"** : seuls IGA-J et IGA-AD ont réellement 8 dimensions (vérifié) ; IGA-E en a 7,
  IGA-A en a 6. Décision : le radar affiche le nombre réel de dimensions du référentiel actif du bénéficiaire, pas
  un total de 8 forcé arbitrairement — écart assumé par rapport à la lettre du document, documenté ici plutôt que
  bâclé en codant "8" en dur.
- **Commission marketplace** déjà paramétrée globalement (`parametres_generaux.taux_commission_marketplace`,
  0.15) — réutilisée telle quelle pour la tarification des cercles d'apprentissage (même mécanique, pas de nouveau
  paramètre).
- **Aucun service d'e-mail transactionnel n'existe dans ce projet** (déjà découvert et documenté lors de la
  construction de `/inscription` : seul GoTrue/Supabase envoie ses propres e-mails de confirmation, l'app elle-même
  n'envoie jamais rien). Conséquence directe sur le mécanisme d'invitation bénéficiaire (section T1 ci-dessous).

## Décisions structurantes

### D1 — Mécanisme d'activation de l'accès bénéficiaire : invitation par le praticien, jamais self-service
Le document présuppose un bénéficiaire déjà connecté avec un tableau de bord. Vu la présence de mineurs et
l'absence de tout portail bénéficiaire jusqu'ici (limite documentée à répétition dans ce projet), un self-signup
public serait inapproprié. Décision : le praticien déclenche l'activation depuis la fiche bénéficiaire (si un
e-mail existe sur le dossier) — génère une ligne `invitations_utilisateurs` (role_propose='beneficiaire',
beneficiaire_id=<id>) et affiche un lien `/inscription-beneficiaire?token=...` que le praticien partage lui-même
(WhatsApp/e-mail, même geste que la messagerie directe déjà construite — pas d'envoi serveur). Le bénéficiaire
suit ce lien, choisit un mot de passe (`supabase.auth.signUp()`, token conservé en `user_metadata`), confirme par
l'e-mail que Supabase envoie automatiquement (mécanisme déjà éprouvé pour `/inscription`), puis à la première
connexion réussie, `finaliserAccesBeneficiaire()` (miroir de `finaliserOrganisationEnAttente()`) lit le token,
retrouve l'invitation, pose `beneficiaires.profile_id = auth.uid()` et marque l'invitation `acceptee`.

### D2 — Comptes multiprofils : aucun changement de schéma de rôles, une couche de redirection/bascule
`membres_organisations`/`roles_utilisateurs` permettent déjà qu'un même `profile_id` cumule plusieurs rôles sur
plusieurs organisations. Un bénéficiaire authentifié via `beneficiaires.profile_id` n'a besoin d'aucune ligne
`membres_organisations` (RLS déjà scopée directement par `profile_id = auth.uid()`). "Comptes multiprofils" devient
donc : (a) `resoudreDestinationConnexion()` étendue pour détecter aussi les fiches bénéficiaire liées à ce profil,
(b) si un profil a **à la fois** une organisation ET au moins un dossier bénéficiaire actif, un sélecteur de vue
apparaît (persisté en cookie, jamais en base — bascule d'affichage pure, aucun état métier). Bascule gratuite et
instantanée, jamais de test IGA déclenché par elle-même (D3).

### D3 — Le test IGA reste lié à l'ouverture d'un dossier, jamais à la bascule de vue
Déjà vrai structurellement : rien dans la bascule de vue ne touche `evaluations_iga`. Documenté ici pour mémoire,
rien à construire de spécifique — la garde-fou est l'absence de tout couplage, pas un couplage désactivé.

### D4 — `projets_vie` passe de 1:1 à 1:N (contrainte retirée, pas de nouvelle table)
`alter table projets_vie drop constraint projets_vie_beneficiaire_id_key` (additive : aucune ligne existante,
aucune perte de données possible). Ajout du fil d'activité comme vue calculée (événements déjà en base), pas
stocké — même principe "vue plutôt que table dupliquée" déjà appliqué à l'IPP.

### D5 — ICC : nouveau module, référentiel local par formation, jamais un standard métier généré automatiquement
Garde-fou explicite du document respecté à la lettre : `icc_referentiels_competences` définis par le formateur à
la création de sa formation (pas de génération auto par métier), `icc_evaluations` (avant/après par bénéficiaire).
Savoir-être calculé depuis les tags d'observation déjà saisis dans `entretiens.donnees` (jsonb) — nécessite un
format de tag minimal, actuellement libre : décision de définir une clé conventionnelle
`donnees->'observations_comportementales'` (tableau de tags), additive, rétrocompatible avec les entretiens déjà
saisis (absence de la clé = simplement aucune observation comptée, jamais une erreur).

### D6 — Cercles d'apprentissage : nouvelle table, pas une extension de `marketplace_offres`
Nature différente (accès à un groupe/abonnement, pas un produit unitaire), mais réutilise le taux de commission
global existant. Modération stricte obligatoire si mineur présent (calculée via `calculer_age()`, déjà en place).

### D7 — Capital social bénéficiaire : nouvelles tables, coexistence avec le module Étape 11 existant
`relations_capital_social` (demande + confirmation mutuelle), jamais de recherche libre dans l'annuaire des
bénéficiaires (condition de contexte partagé vérifiée en base, pas seulement côté UI).

## Portée V1 vs différé (signalé, pas bâclé en silence)

**Construit maintenant** (dans cet ordre, un commit vérifié par phase) :
1. Accès bénéficiaire réel (invitation + activation) + redirection + squelette `/mon-espace` + Boussole d'Autonomie
   (score IGA + radar réel, pas de "prochaine étape"/"explorer" avancés dans cette première phase — panneaux
   placeholder honnêtes si nécessaire)
2. Projet de vie (multi, fil d'activité par règles, carte d'aperçu)
3. ICC (3 sous-scores, référentiel local par formation)
4. Cercles d'apprentissage (création, invitation, modération mineur, alerte décrochage)
5. Capital social bénéficiaire (demande/confirmation, notification parent si mineur)
6. Bascule multi-profils (sélecteur de vue)

**Différé, signalé, non construit en silence** (cohérent avec les réserves propres des deux documents source,
section 8 du dashboard et section 5 des comptes multiprofils) : tarification/paiement réel du test IGA (déjà
différé partout ailleurs dans ce projet, aucun prestataire de paiement intégré) ; droit de réponse du formateur
aux avis (déjà différé, Phase 2 explicite du document IPP) ; veille "Intelligence économique" automatisée (contenu
curé manuellement en V1, explicitement demandé par le document) ; impact sur le parcours d'inscription unifié
(question explicitement laissée ouverte par le document comptes-multiprofils lui-même, section 5) ; réglage fin de
l'affichage croisé formateur↔bénéficiaire dans les annuaires publics (question ouverte, section 5).

## Tâches détaillées

### T1 — Schéma Phase 1 : invitation bénéficiaire, projets_vie 1:N
**Vérification** : script SQL — une invitation bénéficiaire acceptée pose bien `profile_id`, jamais de ligne
`membres_organisations` créée par erreur ; cloisonnement RLS (`profile_id = auth.uid()` déjà en place, testé pour
mémoire) ; deux projets de vie actifs simultanés acceptés sans erreur de contrainte.

### T2 — Activation de l'accès (fiche bénéficiaire → invitation → `/inscription-beneficiaire` → finalisation)
**Vérification** : Playwright — génération du lien, acceptation (compte de test), `beneficiaires.profile_id` posé,
connexion ultérieure redirige vers `/mon-espace`.

### T3 — Squelette `/mon-espace` + Boussole d'Autonomie
**Vérification** : Playwright — un bénéficiaire connecté voit son score IGA global + radar réel (nombre de
dimensions du référentiel réellement actif), aucun accès aux outils de modération/staff.

### T4 — Bascule multi-profils minimale
**Vérification** : Playwright — un compte ayant à la fois une organisation et un dossier bénéficiaire voit un
sélecteur ; la bascule ne déclenche aucun appel vers `evaluations_iga`.

### T5 — Tests + clôture Phase 1, commit

(Phases 2 à 6 : plans détaillés écrits phase par phase au moment de les entamer, même format, pour rester
synchronisés avec ce qui est réellement construit avant plutôt que de tout figer à l'avance.)

## Ordre d'exécution
Phase 1 (T1→T5) → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6.
