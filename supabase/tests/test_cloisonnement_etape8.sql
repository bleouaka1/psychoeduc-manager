-- Script de vérification T4 — cloisonnement multi-organisations, Étape 8 (formations & classes)
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_ben1 uuid;
  v_formation1 uuid;
  v_cours1 uuid;
  v_quiz1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test8-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test8-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A8', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B8', 'structure', v_staff2) returning id into v_org2;

  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'N''Guessan', 'Paul', v_staff1) returning id into v_ben1;
  insert into public.formations (organisation_id, titre, created_by) values (v_org1, 'Formation Test', v_staff1) returning id into v_formation1;
  insert into public.cours (formation_id, organisation_id, titre, created_by) values (v_formation1, v_org1, 'Cours Test', v_staff1) returning id into v_cours1;
  insert into public.quiz (cours_id, organisation_id, titre, created_by) values (v_cours1, v_org1, 'Quiz Test', v_staff1) returning id into v_quiz1;
  insert into public.resultats_quiz (quiz_id, beneficiaire_id, organisation_id, score) values (v_quiz1, v_ben1, v_org1, 15);
  insert into public.competences (organisation_id, nom, created_by) values (v_org1, 'Compétence Test', v_staff1);

  perform set_config('test8.staff2', v_staff2::text, false);
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test8.staff2'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.formations;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit formations de org1'; end if;
  select count(*) into v_count from public.cours;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit cours de org1'; end if;
  select count(*) into v_count from public.quiz;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit quiz de org1'; end if;
  select count(*) into v_count from public.resultats_quiz;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit resultats_quiz de org1'; end if;
  select count(*) into v_count from public.competences;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit competences de org1'; end if;
  raise notice 'OK cloisonnement Etape 8: 0 fuite formations/cours/quiz/resultats/competences vers staff2 (autre organisation)';
end $$;

reset role;
rollback;
