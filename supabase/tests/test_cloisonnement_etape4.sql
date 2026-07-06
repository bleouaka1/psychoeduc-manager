-- Script de vérification T5 — cloisonnement multi-organisations, Étape 4 (utilisateurs & personnel)
begin;
set role postgres;

do $$
declare
  v_user1 uuid := gen_random_uuid();
  v_user2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_membre1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_user1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test4-org1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_user2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test4-org2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A4', 'structure', v_user1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B4', 'structure', v_user2) returning id into v_org2;

  select id into v_membre1 from public.membres_organisations where organisation_id = v_org1 and profile_id = v_user1;

  insert into public.personnel_structures (membre_organisation_id, poste, created_by) values (v_membre1, 'Coordinateur', v_user1);
  insert into public.invitations_utilisateurs (organisation_id, email, role_propose, invite_par) values (v_org1, 'nouveau@example.test', 'formateur', v_user1);
  insert into public.affectations_personnel (organisation_id, membre_organisation_id, cible_type, cible_id, fonction, created_by)
    values (v_org1, v_membre1, 'classe', gen_random_uuid(), 'Responsable classe test', v_user1);
  insert into public.sessions_connexion (organisation_id, profile_id, ip_adresse, created_by) values (v_org1, v_user1, '127.0.0.1', v_user1);

  perform set_config('test4.user1', v_user1::text, false);
  perform set_config('test4.user2', v_user2::text, false);
  perform set_config('test4.org1', v_org1::text, false);
  perform set_config('test4.org2', v_org2::text, false);
end $$;

set role authenticated;

-- user2 (organisation B) ne doit rien voir de l'organisation A
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test4.user2'), 'role', 'authenticated')::text, false);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.personnel_structures;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: user2 voit du personnel de org1'; end if;

  select count(*) into v_count from public.invitations_utilisateurs;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: user2 voit des invitations de org1'; end if;

  select count(*) into v_count from public.affectations_personnel;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: user2 voit des affectations de org1'; end if;

  select count(*) into v_count from public.sessions_connexion where profile_id != current_setting('test4.user2')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: user2 voit la session de user1'; end if;

  raise notice 'OK cloisonnement Etape 4: 0 fuite personnel/invitations/affectations/sessions vers user2';
end $$;

-- user1 doit voir ses propres donnees
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test4.user1'), 'role', 'authenticated')::text, false);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.personnel_structures;
  if v_count <> 1 then raise exception 'ECHEC: user1 devrait voir 1 fiche personnel, en voit %', v_count; end if;

  select count(*) into v_count from public.sessions_connexion where profile_id = current_setting('test4.user1')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: user1 ne voit pas sa propre session'; end if;

  raise notice 'OK: user1 voit correctement ses propres donnees (1 fiche personnel, 1 session)';
end $$;

reset role;
rollback;
