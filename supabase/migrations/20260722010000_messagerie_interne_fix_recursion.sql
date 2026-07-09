-- Correctif : récursion RLS infinie sur conversation_participants (une policy qui
-- s'auto-référence pour vérifier "suis-je participant" déclenche la ré-évaluation
-- de la même policy à l'infini). Même solution déjà appliquée à Étape 1
-- (est_membre_organisation, SECURITY DEFINER) pour exactement ce problème.

create or replace function public.est_participant_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and profile_id = auth.uid()
  );
$$;

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (public.is_fondateur() or public.est_participant_conversation(id));

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update using (public.est_participant_conversation(id));

drop policy if exists conversation_participants_select on public.conversation_participants;
create policy conversation_participants_select on public.conversation_participants
  for select using (
    public.is_fondateur()
    or profile_id = auth.uid()
    or public.est_participant_conversation(conversation_id)
  );

drop policy if exists conversation_participants_insert on public.conversation_participants;
create policy conversation_participants_insert on public.conversation_participants
  for insert with check (
    public.is_fondateur()
    or profile_id = auth.uid()
    or public.est_participant_conversation(conversation_id)
  );

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (
    public.is_fondateur()
    or expediteur_id = auth.uid()
    or destinataire_id = auth.uid()
    or public.peut_lire('messages', organisation_id)
    or (conversation_id is not null and public.est_participant_conversation(conversation_id))
  );

drop policy if exists pieces_jointes_select on public.pieces_jointes;
create policy pieces_jointes_select on public.pieces_jointes
  for select using (
    public.is_fondateur()
    or exists (select 1 from public.messages m where m.id = pieces_jointes.message_id and m.conversation_id is not null and public.est_participant_conversation(m.conversation_id))
  );

drop policy if exists pieces_jointes_insert on public.pieces_jointes;
create policy pieces_jointes_insert on public.pieces_jointes
  for insert with check (
    public.is_fondateur()
    or exists (select 1 from public.messages m where m.id = message_id and m.conversation_id is not null and public.est_participant_conversation(m.conversation_id))
  );

-- Storage : même correctif (les policies interrogeaient conversation_participants
-- directement, aucune récursion possible ici car storage.objects n'a pas de policy
-- récursive sur elle-même, mais on uniformise sur la fonction pour la cohérence).
drop policy if exists messagerie_pieces_jointes_storage_select on storage.objects;
create policy messagerie_pieces_jointes_storage_select on storage.objects
  for select using (
    bucket_id = 'messagerie-pieces-jointes'
    and (public.is_fondateur() or public.est_participant_conversation(((storage.foldername(name))[1])::uuid))
  );

drop policy if exists messagerie_pieces_jointes_storage_insert on storage.objects;
create policy messagerie_pieces_jointes_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'messagerie-pieces-jointes'
    and (public.is_fondateur() or public.est_participant_conversation(((storage.foldername(name))[1])::uuid))
  );
