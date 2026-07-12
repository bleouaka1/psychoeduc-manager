-- Vérification — Cercles d'apprentissage (PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md, Phase 4)
begin;
set role postgres;

do $$
declare
  v_praticien uuid := gen_random_uuid();
  v_membre1_user uuid := gen_random_uuid();
  v_membre2_user uuid := gen_random_uuid();
  v_tiers_user uuid := gen_random_uuid();
  v_org uuid;
  v_conversation uuid;
  v_cercle uuid;
  v_beneficiaire1 uuid;
  v_beneficiaire2 uuid;
  v_beneficiaire_tiers uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_praticien, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testcercle-praticien@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_membre1_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testcercle-membre1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_membre2_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testcercle-membre2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testcercle-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Cercles', 'solo', v_praticien) returning id into v_org;
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, date_naissance, statut_beneficiaire, created_by)
    values (v_org, v_membre1_user, 'Kabore', 'Awa', current_date - interval '20 years', 'actif', v_praticien) returning id into v_beneficiaire1;
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, date_naissance, statut_beneficiaire, created_by)
    values (v_org, v_membre2_user, 'Ouattara', 'Boubacar', current_date - interval '22 years', 'actif', v_praticien) returning id into v_beneficiaire2;
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, date_naissance, statut_beneficiaire, created_by)
    values (v_org, v_tiers_user, 'Sy', 'Fatim', current_date - interval '19 years', 'actif', v_praticien) returning id into v_beneficiaire_tiers;

  insert into public.conversations (organisation_id, titre, created_by) values (v_org, 'Cercle Test', v_praticien) returning id into v_conversation;
  insert into public.conversation_participants (conversation_id, profile_id, role_participant) values (v_conversation, v_praticien, 'staff');

  insert into public.cercles_apprentissage (organisation_id, animateur_profile_id, conversation_id, nom, created_by)
    values (v_org, v_praticien, v_conversation, 'Cercle Menuiserie', v_praticien) returning id into v_cercle;

  insert into public.cercles_membres (cercle_id, beneficiaire_id, statut, invite_par) values (v_cercle, v_beneficiaire1, 'actif', v_praticien);
  insert into public.cercles_membres (cercle_id, beneficiaire_id, statut, invite_par) values (v_cercle, v_beneficiaire2, 'invite', v_praticien);
  insert into public.conversation_participants (conversation_id, profile_id, role_participant) values (v_conversation, v_membre1_user, 'beneficiaire');

  perform set_config('t.membre1', v_membre1_user::text, false);
  perform set_config('t.membre2', v_membre2_user::text, false);
  perform set_config('t.tiers', v_tiers_user::text, false);
  perform set_config('t.cercle', v_cercle::text, false);
  perform set_config('t.conversation', v_conversation::text, false);
end $$;

-- role_participant élargi : un beneficiaire peut être participant (déjà inséré ci-dessus sans erreur)
do $$
declare v_count int;
begin
  select count(*) into v_count from public.conversation_participants where conversation_id = current_setting('t.conversation')::uuid and role_participant = 'beneficiaire';
  if v_count <> 1 then raise exception 'ECHEC: un beneficiaire ne peut pas etre conversation_participant (trouve %)', v_count; end if;
  raise notice 'OK: conversation_participants.role_participant accepte beneficiaire';
end $$;

-- un membre actif voit le cercle et peut poster un message
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.membre1'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.cercles_apprentissage where id = current_setting('t.cercle')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: un membre actif ne voit pas son propre cercle'; end if;

  insert into public.messages (conversation_id, organisation_id, expediteur_id, contenu, type_message, canal)
    select current_setting('t.conversation')::uuid, cercles_apprentissage.organisation_id, current_setting('t.membre1')::uuid, 'Bonjour a tous', 'suivi', 'interne'
    from public.cercles_apprentissage where id = current_setting('t.cercle')::uuid;

  raise notice 'OK: un membre actif voit son cercle et peut poster un message dans la discussion de groupe';
end $$;
reset role;

-- un membre actif voit la composition du cercle (les autres membres), y compris ceux en attente
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.membre1'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.cercles_membres where cercle_id = current_setting('t.cercle')::uuid;
  if v_count <> 2 then raise exception 'ECHEC: un membre actif ne voit pas la composition complete du cercle (trouve %)', v_count; end if;
  raise notice 'OK: un membre actif voit la composition de son cercle (2 membres)';
end $$;
reset role;

-- un tiers (jamais invité) ne voit ni le cercle ni ses membres ni les messages
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.cercles_apprentissage where id = current_setting('t.cercle')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: un tiers voit un cercle dont il n''est pas membre'; end if;

  select count(*) into v_count from public.cercles_membres where cercle_id = current_setting('t.cercle')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: un tiers voit la composition d''un cercle dont il n''est pas membre'; end if;

  select count(*) into v_count from public.messages where conversation_id = current_setting('t.conversation')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: un tiers voit les messages d''un cercle dont il n''est pas membre'; end if;
  raise notice 'OK: un tiers ne voit ni le cercle, ni ses membres, ni ses messages';
end $$;
reset role;

-- membre2 (invité, pas encore actif) accepte : peut mettre a jour son propre statut
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.membre2'), 'role', 'authenticated')::text, false);
do $$
begin
  update public.cercles_membres set statut = 'actif' where cercle_id = current_setting('t.cercle')::uuid
    and beneficiaire_id in (select id from public.beneficiaires where profile_id = current_setting('t.membre2')::uuid);
end $$;
reset role;
do $$
declare v_statut text;
begin
  select statut into v_statut from public.cercles_membres m join public.beneficiaires b on b.id = m.beneficiaire_id
    where m.cercle_id = current_setting('t.cercle')::uuid and b.profile_id = current_setting('t.membre2')::uuid;
  if v_statut is distinct from 'actif' then raise exception 'ECHEC: le membre invite n''a pas pu accepter (statut=%)', v_statut; end if;
  raise notice 'OK: un membre invite peut accepter sa propre invitation (statut -> actif)';
end $$;

reset role;
rollback;
