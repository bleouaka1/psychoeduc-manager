# Plan — Étape 20 : Communication / WhatsApp

Référence : `docs/PsychoEduc_Manager_Architecture_v5.md`, section 22. Champ officiel dans `notifications` : `est_lue` — jamais `lu`.

## Tâches
### T1 — `messages`, `messages_whatsapp`
- `messages(id, organisation_id FK, expediteur_id FK profiles, destinataire_id FK profiles nullable, destinataire_beneficiaire_id FK beneficiaires nullable, contenu text not null, canal text check(interne/email/sms), statut text check(envoye/lu/echoue) default 'envoye', created_by, created_at, updated_at)`.
- `messages_whatsapp(id, organisation_id FK, destinataire_telephone text, contenu text, statut text check(en_attente/envoye/livre/echoue) default 'en_attente', reference_externe text, envoye_le timestamptz, created_by, created_at)`.

### T2 — `campagnes_messages`, `modeles_messages`
- `campagnes_messages(id, organisation_id FK, nom text not null, canal text check(whatsapp/email/sms), contenu_modele text, cible_type text, statut text check(brouillon/en_cours/terminee) default 'brouillon', date_lancement timestamptz, created_by, updated_by, created_at, updated_at)`.
- `modeles_messages(id, organisation_id FK nullable, nom text not null, canal text, contenu text, variables jsonb, created_by, updated_by, created_at, updated_at)`.

### T3 — `notifications`
`notifications(id, profile_id FK, organisation_id FK nullable, titre text, contenu text, type_notification text, est_lue boolean not null default false, created_at)`. **Jamais de colonne `lu`** — vérifié explicitement.

### T4 — Index, seed permissions, RLS + test (obligatoire)
`notifications`/`messages` : un utilisateur voit les siens (expéditeur/destinataire/profile_id), staff org-scopé pour la gestion des campagnes. Vérification : cloisonnement (2 organisations), un utilisateur ne voit pas les notifications d'un autre.

### T5 — Clôture
Mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md`.

## Ordre : T1→T2→T3→T4→T5
