-- Script de vérification T5 — cloisonnement multi-organisations, Étape 3 (clients)
begin;
set role postgres;

do $$
declare
  v_user1 uuid := gen_random_uuid();
  v_user2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_user1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test3-org1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_user2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test3-org2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A3', 'structure', v_user1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Employeur Test B3', 'employeur', v_user2) returning id into v_org2;

  insert into public.details_structures (organisation_id, secteur_activite, created_by) values (v_org1, 'education', v_user1);
  insert into public.details_employeurs (organisation_id, secteur_activite, taille_entreprise, created_by) values (v_org2, 'btp', 'pme', v_user2);
  insert into public.implantations (organisation_id, pays, ville, est_siege, created_by) values (v_org1, 'Côte d''Ivoire', 'Abidjan', true, v_user1);
  insert into public.implantations (organisation_id, pays, ville, est_siege, created_by) values (v_org1, 'Côte d''Ivoire', 'Bouaké', false, v_user1);

  perform set_config('test3.user1', v_user1::text, false);
  perform set_config('test3.org1', v_org1::text, false);
  perform set_config('test3.org2', v_org2::text, false);
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test3.user1'), 'role', 'authenticated')::text, false);

do $$
declare
  v_count int;
  v_org1 uuid := current_setting('test3.org1')::uuid;
  v_org2 uuid := current_setting('test3.org2')::uuid;
begin
  select count(*) into v_count from public.implantations where organisation_id = v_org1;
  if v_count <> 2 then raise exception 'ECHEC: user1 devrait voir 2 implantations de sa propre organisation, en voit %', v_count; end if;

  select count(*) into v_count from public.details_employeurs where organisation_id = v_org2;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: user1 voit details_employeurs de org2 (fuite!)'; end if;

  select count(*) into v_count from public.implantations where organisation_id = v_org2;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: user1 voit implantations de org2 (fuite!)'; end if;

  raise notice 'OK cloisonnement Etape 3: 2 implantations propres visibles, 0 fuite vers org2';
end $$;

-- contrainte un seul siege par organisation
do $$
begin
  begin
    insert into public.implantations (organisation_id, pays, ville, est_siege, created_by)
    values (current_setting('test3.org1')::uuid, 'Côte d''Ivoire', 'Yamoussoukro', true, current_setting('test3.user1')::uuid);
    raise exception 'ECHEC: un 2e siege a pu etre insere pour la meme organisation';
  exception
    when unique_violation then
      raise notice 'OK contrainte metier: un seul siege par organisation';
  end;
end $$;

-- ecriture croisee bloquee
do $$
begin
  begin
    insert into public.details_structures (organisation_id, secteur_activite, created_by)
    values (current_setting('test3.org2')::uuid, 'test', current_setting('test3.user1')::uuid);
    raise exception 'ECHEC cloisonnement: user1 a pu creer details_structures pour org2';
  exception
    when insufficient_privilege or others then
      raise notice 'OK cloisonnement INSERT: ecriture croisee vers org2 bloquee';
  end;
end $$;

reset role;
rollback;
