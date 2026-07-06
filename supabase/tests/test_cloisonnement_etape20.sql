-- Script de vérification T4 — cloisonnement + notifications privées, Étape 20
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test20-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test20-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A20', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B20', 'structure', v_staff2) returning id into v_org2;

  insert into public.messages (organisation_id, expediteur_id, destinataire_id, contenu, created_by) values (v_org1, v_staff1, v_staff1, 'Message test', v_staff1);
  insert into public.campagnes_messages (organisation_id, nom, created_by) values (v_org1, 'Campagne test', v_staff1);
  insert into public.notifications (profile_id, organisation_id, titre, est_lue) values (v_staff1, v_org1, 'Notif test', false);

  perform set_config('test20.staff1', v_staff1::text, false);
  perform set_config('test20.staff2', v_staff2::text, false);
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test20.staff2'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.messages;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit messages de org1'; end if;
  select count(*) into v_count from public.campagnes_messages;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit campagnes_messages de org1'; end if;
  select count(*) into v_count from public.notifications;
  if v_count <> 0 then raise exception 'ECHEC SECURITE: staff2 voit les notifications de staff1 (un autre utilisateur)'; end if;
  raise notice 'OK Etape 20: 0 fuite messages/campagnes/notifications vers staff2 (autre organisation/autre utilisateur)';
end $$;

-- verifie que la colonne s'appelle bien est_lue, jamais "lu"
set role postgres;
do $$
declare v_exists boolean;
begin
  select exists(select 1 from information_schema.columns where table_name='notifications' and column_name='est_lue') into v_exists;
  if not v_exists then raise exception 'ECHEC: colonne est_lue absente de notifications'; end if;
  select exists(select 1 from information_schema.columns where table_name='notifications' and column_name='lu') into v_exists;
  if v_exists then raise exception 'ECHEC: colonne "lu" presente alors qu''elle est explicitement interdite par le document'; end if;
  raise notice 'OK: colonne notifications.est_lue presente, colonne "lu" absente (conforme au document)';
end $$;

reset role;
rollback;
