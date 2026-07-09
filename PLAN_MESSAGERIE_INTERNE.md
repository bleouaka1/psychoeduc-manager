# Plan — Messagerie interne (Inbox)

Réf : `CLAUDE-CODE-Messagerie-Interne.md`. Mode autonome, décisions documentées et non bloquantes.

## Constat — adaptation aux conventions réelles du projet (le document le demandait explicitement)

- **Aucune table `dossiers`** dans ce projet — l'équivalent fonctionnel est `beneficiaires` (déjà utilisé comme
  pivot partout ailleurs : `destinataire_beneficiaire_id`, `entretiens`, `messagerie directe`). `dossier_id`
  devient `beneficiaire_id` (nullable — une conversation Fondateur↔staff n'est pas toujours liée à un bénéficiaire).
- **`messages` existe déjà** (Étape 20, étendue 3 fois cette session : `destinataire_beneficiaire_id`,
  `marketplace_offre_id`, `type_message`). Le document proposait de recréer une table `messages` — collision de
  nom qui aurait dupliqué toute l'infrastructure existante. **Décision : étendre la table existante**
  (`conversation_id`, `type_document`, `statut_demande` additifs ; `type_message` élargi à `'demande_piece'`),
  comme déjà fait pour `marketplace_offre_id`/`gestion_beneficiaires`.
- **Police "Cinzel" mentionnée dans le document ne correspond à aucune police réellement utilisée** dans ce
  projet — le thème sombre "Boussole d'autonomie" utilise Fraunces (`font-display`) pour les titres. Utilisé tel
  quel, pas Cinzel.
- **Écart structurel majeur, déjà documenté dans `ETAT_PROJET.md` avant ce document** : "chaque profil
  (bénéficiaire, parent/tuteur, formateur, structure) dispose d'une boîte de réception" n'est aujourd'hui
  réalisable que pour les comptes qui ont réellement un compte de connexion — c'est-à-dire le personnel
  (Solo/Structure/Employeur) et le Fondateur. **Les bénéficiaires n'ont pas de portail** ("aucun portail
  bénéficiaire n'existe dans l'app à ce jour, en construire un serait une décision structurante à valider avec
  Angenor" — déjà noté avant ce document) et **les parents/tuteurs n'ont aucun compte de connexion du tout**
  (`parents_tuteurs` n'a pas de `profile_id`, contrairement à `beneficiaires`). Construire une authentification
  et un portail pour ces deux profils serait une décision structurante à part entière, pas un sous-produit
  silencieux d'une fonctionnalité de messagerie. **Non construit ici, signalé explicitement** — cohérent avec
  la position déjà prise sur ce sujet précis avant ce document.

## Portée V1 réellement construite

Messagerie interne **threadée** (conversations, pas des messages isolés comme aujourd'hui) entre comptes ayant
une connexion réelle : Fondateur ↔ n'importe quel compte Solo/Structure/Employeur (toujours autorisé, symétrique
au mécanisme "Contacter le Fondateur" déjà construit) ; staff ↔ staff d'une autre organisation uniquement s'ils
partagent un bénéficiaire commun (vérifié applicativement, cf. `affectations_personnel`/`created_by`). Chaque
conversation peut être liée à un bénéficiaire (le "dossier"), optionnel. Demande de pièce justificative
(Fondateur uniquement) avec suivi de statut `en_attente`/`recu`, pièces jointes via bucket Storage privé et URL
signée courte durée (5 min), jamais d'URL permanente stockée.

## Tâches

### T1 — Schéma
`conversations` (id, beneficiaire_id nullable, titre, organisation_id, created_by, created_at) ;
`conversation_participants` (conversation_id, profile_id, role_participant, created_at, unique) ;
`pieces_jointes` (message_id, fichier_path, nom_original, taille_octets, type_mime, created_at) ; `messages`
étendue (`conversation_id`, `type_document`, `statut_demande` check `en_attente|recu`) ; `type_message` élargi
à `'demande_piece'` ; bucket Storage privé `messagerie-pieces-jointes` avec policies scopées par
`conversation_id` des participants.
**Vérification** : script SQL — un profil non-participant ne voit ni la conversation ni ses messages ni ses
pièces jointes ; le Fondateur peut lire toute conversation ; seul un profil avec le rôle `fondateur` dans la
conversation peut insérer un message `type_message='demande_piece'`.

### T2 — Logique serveur (TypeScript)
`creerConversation` (règle de partage de bénéficiaire vérifiée applicativement, pas seulement par RLS) ;
`envoyerMessage` ; `demanderPiece` (fondateur uniquement) ; `repondreAvecPieceJointe` (upload + insert +
passage automatique du dernier `demande_piece` en_attente de la conversation à `recu`, logique applicative
comme demandé par le document, pas de trigger SQL).
**Vérification** : script Node/SQL — l'upload d'une pièce marque bien la bonne demande comme reçue, jamais une
demande d'une autre conversation.

### T3 — UI `/messagerie`
Layout deux colonnes (liste de conversations + fil), `ConversationRow` (avatar initiales, badge rôle, aperçu,
badge non-lus), `Thread` (bulles alignées par expéditeur), `DemandeCard` (statut visuel ambre/vert), panneau
"Demander une pièce" (visible seulement si rôle fondateur dans la conversation), barre de composition
(texte + pièce jointe + demande conditionnelle + envoyer). Thème sombre existant réutilisé (`Panel`,
`StatusPill`, `font-display`/Fraunces), pas de nouvelle charte.
**Vérification** : Playwright — cycle complet Fondateur→Solo : conversation créée, demande de pièce envoyée,
réponse avec pièce jointe, statut passé à "reçu" visible des deux côtés.

### T4 — Intégration
Point d'entrée "Ouvrir la messagerie interne" depuis la fiche bénéficiaire (à côté du bouton "Envoyer un
message" WhatsApp/Email existant, inchangé). Badge non-lus dans le Topbar Fondateur (icône déjà présente,
jamais câblée) et dans `SoloTabs`.
**Vérification** : Playwright, navigation.spec.ts étendu à `/messagerie`.

### T5 — Tests + clôture
Suite complète rejouée, `ETAT_PROJET.md`/`DECISIONS_LOG.md` mis à jour, `tsc --noEmit` propre.

## Limites strictes respectées
Aucune suppression physique (statut logique si besoin plus tard) ; aucun déploiement production (rien ne l'est
dans ce projet, tout est directement sur la base de dev/prod unique déjà utilisée toute la session) ; aucune
touche aux clés/config de paiement.

## Ordre d'exécution
T1 → T2 → T3 → T4 → T5.
