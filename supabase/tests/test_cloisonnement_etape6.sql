-- Script de vérification T6 — cloisonnement multi-organisations, Étape 6 (présences)
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_ben1 uuid;
  v_classe1 uuid;
  v_presence1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test6-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test6-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A6', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B6', 'structure', v_staff2) returning id into v_org2;

  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'Yao', 'Kacou', v_staff1) returning id into v_ben1;
  insert into public.classes_groupes (organisation_id, nom, created_by) values (v_org1, 'Classe A', v_staff1) returning id into v_classe1;
  insert into public.inscriptions_classes (classe_id, beneficiaire_id, organisation_id, created_by) values (v_classe1, v_ben1, v_org1, v_staff1);
  insert into public.presences (classe_id, beneficiaire_id, organisation_id, date_seance, statut, created_by) values (v_classe1, v_ben1, v_org1, current_date, 'absent', v_staff1) returning id into v_presence1;
  insert into public.absences (presence_id, beneficiaire_id, organisation_id, motif, created_by) values (v_presence1, v_ben1, v_org1, 'maladie', v_staff1);
  insert into public.alertes_assiduite (beneficiaire_id, organisation_id, type_alerte, statut) values (v_ben1, v_org1, 'absences_repetees', 'active');

  perform set_config('test6.staff2', v_staff2::text, false);
  perform set_config('test6.org1', v_org1::text, false);
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test6.staff2'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.classes_groupes where organisation_id = current_setting('test6.org1')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit classes_groupes de org1'; end if;
  select count(*) into v_count from public.presences;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit presences de org1'; end if;
  select count(*) into v_count from public.absences;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit absences de org1'; end if;
  select count(*) into v_count from public.alertes_assiduite;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit alertes_assiduite de org1'; end if;
  raise notice 'OK cloisonnement Etape 6: 0 fuite classes/presences/absences/alertes vers staff2 (autre organisation)';
end $$;

reset role;
rollback;
