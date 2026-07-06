-- Gestion des bénéficiaires (PROMPT-GESTION-BENEFICIAIRES.md)
-- Migration additive uniquement.

-- ============================================================================
-- T1 — statut_beneficiaire élargi : 'en_attente' (demande non validée), 'refuse'
-- (demande refusée, conservée pour référence), 'archive' (distinct de 'sorti' :
-- 'sorti' = a réellement quitté le programme, 'archive' = retiré des listes
-- actives sans jugement sur la situation, alternative à la suppression directe).
-- ============================================================================
alter table public.beneficiaires drop constraint if exists beneficiaires_statut_beneficiaire_check;
alter table public.beneficiaires add constraint beneficiaires_statut_beneficiaire_check
  check (statut_beneficiaire in ('actif','inactif','suspendu','sorti','archive','en_attente','refuse'));

alter table public.beneficiaires
  add column if not exists motif_refus text,
  add column if not exists valide_par uuid references public.profiles(id),
  add column if not exists date_validation timestamptz;

-- ============================================================================
-- T2 — messages typés : suivi (visible bénéficiaire) / entretien (lié à une séance,
-- visible bénéficiaire) / signalement (JAMAIS visible par le bénéficiaire concerné,
-- réservé au personnel de l'organisation).
-- ============================================================================
alter table public.messages
  add column if not exists type_message text not null default 'suivi' check (type_message in ('suivi','entretien','signalement')),
  add column if not exists seance_id uuid references public.seances(id) on delete set null;

-- Le bénéficiaire voit SES messages de suivi/entretien (jamais les signalements),
-- même s'il n'est ni expéditeur ni destinataire_id direct (le message lui est adressé
-- via destinataire_beneficiaire_id). Policy additionnelle, combinée en OR avec l'existante.
drop policy if exists messages_select_beneficiaire on public.messages;
create policy messages_select_beneficiaire on public.messages
  for select using (
    type_message <> 'signalement'
    and exists (select 1 from public.beneficiaires b where b.id = messages.destinataire_beneficiaire_id and b.profile_id = auth.uid())
  );

-- ============================================================================
-- T3 — permissions : la validation/refus d'une demande utilise peut_modifier sur
-- 'beneficiaires' (déjà accordé), aucune nouvelle ligne de permissions nécessaire.
-- ============================================================================

-- ============================================================================
-- Index
-- ============================================================================
create index if not exists idx_messages_destinataire_beneficiaire_type on public.messages(destinataire_beneficiaire_id, type_message);
