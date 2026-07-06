-- Messagerie ciblée sur une offre Marketplace (PLAN_MODERATION_MARKETPLACE.md, tâche B2).
-- Réutilise entièrement la table `messages` existante (Étape 20) plutôt qu'un nouveau
-- système parallèle. Migration additive uniquement.

-- ============================================================================
-- T1 — messages.marketplace_offre_id : pointeur nullable vers l'offre concernée,
-- même pattern que `destinataire_beneficiaire_id` (migration gestion_beneficiaires).
-- Aucune nouvelle policy RLS nécessaire : messages_select/insert/update (Étape 20)
-- scopent déjà chaque ligne par expediteur_id/destinataire_id = auth.uid() (ou
-- is_fondateur()), ce qui isole déjà une conversation par destinataire — le
-- cloisonnement par vendeur en découle directement, sans logique supplémentaire.
-- ============================================================================
alter table public.messages
  add column if not exists marketplace_offre_id uuid references public.marketplace_offres(id) on delete set null;

create index if not exists idx_messages_marketplace_offre_id on public.messages(marketplace_offre_id);

-- ============================================================================
-- T2 — type_message : élargit le check existant (Étape gestion_beneficiaires,
-- 'suivi'|'entretien'|'signalement') pour distinguer les messages de modération
-- marketplace des messages de suivi bénéficiaire — élargissement additif, jamais
-- destructif (les valeurs existantes restent valides).
-- ============================================================================
alter table public.messages drop constraint if exists messages_type_message_check;
alter table public.messages add constraint messages_type_message_check
  check (type_message in ('suivi', 'entretien', 'signalement', 'moderation_marketplace'));
