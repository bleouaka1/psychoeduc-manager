-- Vérification — Messagerie interne (PLAN_MESSAGERIE_INTERNE.md, tâche T1)
begin;
set role postgres;

do $$
declare
  v_fondateur uuid;
  v_staff_a uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
  v_conversation uuid;
  v_message uuid;
begin
  select id into v_fondateur from auth.users where email = 'bleouaka1@gmail.com';

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testmsginterne-staffa@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testmsginterne-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Messagerie Interne', 'solo', v_staff_a) returning id into v_org;

  insert into public.conversations (titre, organisation_id, created_by) values ('Conversation test', v_org, v_staff_a) returning id into v_conversation;
  insert into public.conversation_participants (conversation_id, profile_id, role_participant) values (v_conversation, v_staff_a, 'staff');

  insert into public.messages (conversation_id, organisation_id, expediteur_id, contenu, type_message, canal, created_by)
    values (v_conversation, v_org, v_staff_a, 'Bonjour', 'suivi', 'interne', v_staff_a) returning id into v_message;

  perform set_config('t.fondateur', v_fondateur::text, false);
  perform set_config('t.staff_a', v_staff_a::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.conversation', v_conversation::text, false);
  perform set_config('t.message', v_message::text, false);
end $$;

-- un tiers non-participant ne voit ni la conversation ni le message
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.conversations where id = current_setting('t.conversation')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: un tiers non-participant voit la conversation'; end if;

  select count(*) into v_count from public.messages where conversation_id = current_setting('t.conversation')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: un tiers non-participant voit le message de la conversation'; end if;

  raise notice 'OK cloisonnement: un tiers non-participant ne voit ni la conversation ni ses messages';
end $$;
reset role;

-- le participant voit sa propre conversation et son message
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.staff_a'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.conversations where id = current_setting('t.conversation')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le participant ne voit pas sa propre conversation'; end if;
  raise notice 'OK: le participant voit sa propre conversation';
end $$;
reset role;

-- le fondateur voit toutes les conversations (lecture) sans etre participant
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.fondateur'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.conversations where id = current_setting('t.conversation')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le fondateur ne voit pas une conversation dont il n''est pas participant'; end if;
  raise notice 'OK: le fondateur voit toute conversation en lecture, meme sans etre participant';
end $$;
reset role;

-- seul un message avec type_message='demande_piece' + statut_demande accepte les valeurs attendues
do $$
begin
  begin
    insert into public.messages (conversation_id, organisation_id, expediteur_id, contenu, type_message, statut_demande, canal, created_by)
    values (
      current_setting('t.conversation')::uuid,
      (select organisation_id from public.conversations where id = current_setting('t.conversation')::uuid),
      current_setting('t.staff_a')::uuid, 'test', 'demande_piece', 'valeur_invalide', 'interne', current_setting('t.staff_a')::uuid
    );
    raise exception 'ECHEC: statut_demande invalide accepte';
  exception when check_violation then
    raise notice 'OK: contrainte check sur statut_demande fonctionne';
  end;
end $$;

reset role;
rollback;
