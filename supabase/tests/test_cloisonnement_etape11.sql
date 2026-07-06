-- Script de vérification T3 — cloisonnement + vue capital_social, Étape 11
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_ben1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test11-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test11-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A11', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B11', 'structure', v_staff2) returning id into v_org2;

  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'Coulibaly', 'Aicha', v_staff1) returning id into v_ben1;

  insert into public.evaluations_capital_social (beneficiaire_id, organisation_id, date_evaluation, score_global, niveau, created_by)
    values (v_ben1, v_org1, current_date - 60, 40, 'faible', v_staff1);
  insert into public.evaluations_capital_social (beneficiaire_id, organisation_id, date_evaluation, score_global, niveau, created_by)
    values (v_ben1, v_org1, current_date, 65, 'moyen', v_staff1);

  perform set_config('test11.staff2', v_staff2::text, false);
  perform set_config('test11.ben1', v_ben1::text, false);
end $$;

-- la vue capital_social retourne la DERNIERE evaluation (65), pas la premiere (40)
set role postgres;
do $$
declare v_score numeric;
begin
  select score_global into v_score from public.capital_social where beneficiaire_id = current_setting('test11.ben1')::uuid;
  if v_score <> 65 then raise exception 'ECHEC vue capital_social: retourne % au lieu de 65 (derniere evaluation)', v_score; end if;
  raise notice 'OK vue capital_social: retourne bien la derniere evaluation (65), pas la premiere (40)';
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test11.staff2'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.evaluations_capital_social;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit evaluations_capital_social de org1'; end if;
  select count(*) into v_count from public.capital_social;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit capital_social (vue) de org1'; end if;
  raise notice 'OK cloisonnement Etape 11: 0 fuite evaluations_capital_social/capital_social vers staff2 (autre organisation)';
end $$;

reset role;
rollback;
