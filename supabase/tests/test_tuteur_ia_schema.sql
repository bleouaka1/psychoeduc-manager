-- Vérification — Espace Tuteurs IA (dashboard bénéficiaire v2, Lot D)
begin;
set role postgres;

do $$
declare
  v_beneficiaire_a_user uuid := gen_random_uuid();
  v_beneficiaire_b_user uuid := gen_random_uuid();
  v_org uuid;
  v_beneficiaire_a uuid;
  v_beneficiaire_b uuid;
  v_persona uuid;
  v_session uuid;
  v_message uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_beneficiaire_a_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testtuteuria-benef-a@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_beneficiaire_b_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testtuteuria-benef-b@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Tuteur IA', 'solo', v_beneficiaire_a_user) returning id into v_org;

  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org, v_beneficiaire_a_user, 'Kone', 'Aminata', 'actif', v_beneficiaire_a_user) returning id into v_beneficiaire_a;
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org, v_beneficiaire_b_user, 'Sangare', 'Boubacar', 'actif', v_beneficiaire_b_user) returning id into v_beneficiaire_b;

  select id into v_persona from public.tuteur_personas where objectif = 'entretien' limit 1;

  insert into public.tuteur_sessions (beneficiaire_id, organisation_id, persona_id) values (v_beneficiaire_a, v_org, v_persona) returning id into v_session;
  insert into public.tuteur_messages (session_id, role, contenu) values (v_session, 'user', 'Bonjour') returning id into v_message;

  perform set_config('t.benef_a_user', v_beneficiaire_a_user::text, false);
  perform set_config('t.benef_b_user', v_beneficiaire_b_user::text, false);
  perform set_config('t.session', v_session::text, false);
  perform set_config('t.message', v_message::text, false);
end $$;

-- Le bénéficiaire A voit sa propre session et son propre message
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.benef_a_user'), 'role', 'authenticated')::text, false);
do $$
declare v_session_count int; v_message_count int;
begin
  select count(*) into v_session_count from public.tuteur_sessions where id = current_setting('t.session')::uuid;
  select count(*) into v_message_count from public.tuteur_messages where id = current_setting('t.message')::uuid;
  if v_session_count <> 1 or v_message_count <> 1 then
    raise exception 'ECHEC: le beneficiaire ne voit pas sa propre session/message (session=%, message=%)', v_session_count, v_message_count;
  end if;
  raise notice 'OK: le beneficiaire voit sa propre session et son propre message';
end $$;
reset role;

-- Cloisonnement : le bénéficiaire B ne voit ni la session ni le message de A
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.benef_b_user'), 'role', 'authenticated')::text, false);
do $$
declare v_session_count int; v_message_count int;
begin
  select count(*) into v_session_count from public.tuteur_sessions where id = current_setting('t.session')::uuid;
  select count(*) into v_message_count from public.tuteur_messages where id = current_setting('t.message')::uuid;
  if v_session_count <> 0 or v_message_count <> 0 then
    raise exception 'ECHEC cloisonnement: le beneficiaire B voit des donnees du beneficiaire A (session=%, message=%)', v_session_count, v_message_count;
  end if;
  raise notice 'OK cloisonnement: le beneficiaire B ne voit rien du beneficiaire A';
end $$;
reset role;

-- Le bénéficiaire B ne peut pas insérer un message sur la session de A
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.benef_b_user'), 'role', 'authenticated')::text, false);
do $$
begin
  begin
    insert into public.tuteur_messages (session_id, role, contenu) values (current_setting('t.session')::uuid, 'user', 'Intrusion');
    raise exception 'ECHEC securite: le beneficiaire B a pu inserer un message sur la session de A';
  exception
    when others then
      if sqlerrm like 'ECHEC securite%' then raise; end if;
      raise notice 'OK: le beneficiaire B ne peut pas inserer un message sur la session de A (bloque par RLS)';
  end;
end $$;
reset role;

reset role;
rollback;
