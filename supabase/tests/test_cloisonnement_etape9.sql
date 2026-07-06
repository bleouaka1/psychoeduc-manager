-- Script de vérification T9 — cloisonnement + securite mineurs, Étape 9 (IGA)
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_ben_user uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_membre_ben uuid;
  v_ben1 uuid;
  v_ben_autre uuid;
  v_ref_id uuid;
  v_dim_id uuid;
  v_eval1 uuid;
  v_eval_autre uuid;
  i int;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test9-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test9-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_ben_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test9-ben@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A9', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B9', 'structure', v_staff2) returning id into v_org2;

  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'Kone', 'Fatim', v_staff1) returning id into v_ben1;
  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'Diallo', 'Sekou', v_staff1) returning id into v_ben_autre;

  update public.beneficiaires set profile_id = v_ben_user where id = v_ben1;

  insert into public.membres_organisations (organisation_id, profile_id, statut, created_by) values (v_org1, v_ben_user, 'actif', v_staff1) returning id into v_membre_ben;
  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by) values (v_membre_ben, 'beneficiaire', v_staff1);

  select id into v_ref_id from public.referentiels_iga where actif = true;

  insert into public.evaluations_iga (beneficiaire_id, organisation_id, referentiel_version_id, evalue_par, score_global, niveau, created_by)
    values (v_ben1, v_org1, v_ref_id, v_staff1, 62, 'autonomie_fonctionnelle', v_staff1) returning id into v_eval1;
  insert into public.evaluations_iga (beneficiaire_id, organisation_id, referentiel_version_id, evalue_par, score_global, niveau, created_by)
    values (v_ben_autre, v_org1, v_ref_id, v_staff1, 45, 'autonomie_emergente', v_staff1) returning id into v_eval_autre;

  select id into v_dim_id from public.dimensions_iga where referentiel_id = v_ref_id and code = 'discipline';
  insert into public.scores_iga (evaluation_id, dimension_id, score) values (v_eval1, v_dim_id, 70);

  -- classements pour org1 : ben1 rang 1, ben_autre rang 2 ; + 150 lignes bidon pour tester top100
  insert into public.classements_iga (organisation_id, beneficiaire_id, periode_type, periode, rang, score_global) values (v_org1, v_ben1, 'mensuel', current_date, 1, 62);
  insert into public.classements_iga (organisation_id, beneficiaire_id, periode_type, periode, rang, score_global) values (v_org1, v_ben_autre, 'mensuel', current_date, 2, 45);
  for i in 3..150 loop
    insert into public.classements_iga (organisation_id, beneficiaire_id, periode_type, periode, rang, score_global) values (v_org1, v_ben_autre, 'mensuel', current_date - i, i, 0);
  end loop;

  perform set_config('test9.staff1', v_staff1::text, false);
  perform set_config('test9.staff2', v_staff2::text, false);
  perform set_config('test9.ben_user', v_ben_user::text, false);
  perform set_config('test9.org1', v_org1::text, false);
  perform set_config('test9.ben1', v_ben1::text, false);
  perform set_config('test9.ben_autre', v_ben_autre::text, false);
end $$;

-- un seul referentiel actif : verification de la contrainte
do $$
begin
  begin
    insert into public.referentiels_iga (version, actif) values (2, true);
    raise exception 'ECHEC: un 2e referentiel actif a pu etre insere';
  exception
    when unique_violation then
      raise notice 'OK contrainte: un seul referentiel_iga actif a la fois';
  end;
end $$;

-- top100_iga filtre bien rang <= 100
do $$
declare
  v_count_classements int;
  v_count_top100 int;
begin
  select count(*) into v_count_classements from public.classements_iga where organisation_id = current_setting('test9.org1')::uuid;
  select count(*) into v_count_top100 from public.top100_iga where organisation_id = current_setting('test9.org1')::uuid;
  if v_count_classements <= 100 then raise exception 'ECHEC setup test: pas assez de lignes de classement pour tester le filtre top100'; end if;
  if v_count_top100 <> 100 then raise exception 'ECHEC vue top100_iga: retourne % lignes au lieu de 100', v_count_top100; end if;
  raise notice 'OK vue top100_iga: filtre correctement rang<=100 (% classements -> 100 dans le top)', v_count_classements;
end $$;

set role authenticated;

-- staff2 (organisation B) : 0 fuite
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test9.staff2'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.evaluations_iga;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit des evaluations de org1'; end if;
  select count(*) into v_count from public.classements_iga;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit des classements de org1'; end if;
  raise notice 'OK cloisonnement Etape 9: 0 fuite evaluations/classements vers staff2 (autre organisation)';
end $$;

-- POINT CRITIQUE : le beneficiaire ne voit que SA PROPRE evaluation et SA PROPRE ligne de classement
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test9.ben_user'), 'role', 'authenticated')::text, false);
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.evaluations_iga;
  if v_count <> 1 then raise exception 'ECHEC SECURITE: le beneficiaire voit % evaluations au lieu de 1 (la sienne)', v_count; end if;

  select count(*) into v_count from public.evaluations_iga where beneficiaire_id = current_setting('test9.ben_autre')::uuid;
  if v_count <> 0 then raise exception 'ECHEC SECURITE CRITIQUE: le beneficiaire voit l''evaluation d''un AUTRE beneficiaire'; end if;

  select count(*) into v_count from public.classements_iga;
  if v_count <> 1 then raise exception 'ECHEC SECURITE: le beneficiaire voit % lignes de classement au lieu de 1 (la sienne), fuite du classement des pairs', v_count; end if;

  select count(*) into v_count from public.scores_iga;
  if v_count <> 1 then raise exception 'ECHEC: le beneficiaire ne voit pas son propre score_iga (dimension discipline)'; end if;

  raise notice 'OK SECURITE CRITIQUE Etape 9: le beneficiaire ne voit que sa propre evaluation (1/1), son propre score, sa propre ligne de classement (1/150) -- aucune fuite du classement des pairs';
end $$;

reset role;
rollback;
