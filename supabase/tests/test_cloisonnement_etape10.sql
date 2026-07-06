-- Script de vérification T4 — cloisonnement + append-only, Étape 10 (AGR)
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_ben1 uuid;
  v_activite1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test10-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test10-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A10', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B10', 'structure', v_staff2) returning id into v_org2;

  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'Ouattara', 'Salif', v_staff1) returning id into v_ben1;
  insert into public.activites_agr (beneficiaire_id, organisation_id, nom_activite, created_by) values (v_ben1, v_org1, 'Vente de vivriers', v_staff1) returning id into v_activite1;
  insert into public.revenus_agr (activite_agr_id, organisation_id, montant, created_by) values (v_activite1, v_org1, 25000, v_staff1);
  insert into public.charges_agr (activite_agr_id, organisation_id, montant, created_by) values (v_activite1, v_org1, 8000, v_staff1);

  perform set_config('test10.staff2', v_staff2::text, false);
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test10.staff2'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.activites_agr;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit activites_agr de org1'; end if;
  select count(*) into v_count from public.revenus_agr;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit revenus_agr de org1'; end if;
  raise notice 'OK cloisonnement Etape 10: 0 fuite activites_agr/revenus_agr vers staff2 (autre organisation)';
end $$;

-- retour au staff proprietaire pour tester l'append-only
do $$ begin perform set_config('request.jwt.claims', '', false); end $$;

set role postgres;
do $$
declare v_staff1 uuid;
begin
  select created_by into v_staff1 from public.activites_agr limit 1;
  perform set_config('test10.staff1', v_staff1::text, false);
end $$;
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test10.staff1'), 'role', 'authenticated')::text, false);

do $$
begin
  begin
    update public.revenus_agr set montant = 999999 where true;
    raise exception 'ECHEC append-only revenus_agr: UPDATE a reussi';
  exception
    when insufficient_privilege or others then
      raise notice 'OK append-only revenus_agr: UPDATE bloque';
  end;

  begin
    delete from public.charges_agr where true;
    raise exception 'ECHEC append-only charges_agr: DELETE a reussi';
  exception
    when insufficient_privilege or others then
      raise notice 'OK append-only charges_agr: DELETE bloque';
  end;
end $$;

reset role;
rollback;
