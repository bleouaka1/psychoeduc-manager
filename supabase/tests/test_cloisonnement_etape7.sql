-- Script de vérification T3 — cloisonnement multi-organisations, Étape 7 (suivi psycho-éducatif)
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
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test7-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test7-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A7', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B7', 'structure', v_staff2) returning id into v_org2;

  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'Bamba', 'Awa', v_staff1) returning id into v_ben1;

  insert into public.suivis (beneficiaire_id, organisation_id, type_suivi, created_by) values (v_ben1, v_org1, 'psycho-educatif', v_staff1);
  insert into public.entretiens (beneficiaire_id, organisation_id, compte_rendu, created_by) values (v_ben1, v_org1, 'Entretien test', v_staff1);
  insert into public.incidents (beneficiaire_id, organisation_id, description, created_by) values (v_ben1, v_org1, 'Incident test', v_staff1);
  insert into public.projets_vie (beneficiaire_id, organisation_id, titre, created_by) values (v_ben1, v_org1, 'Devenir formateur', v_staff1);

  perform set_config('test7.staff2', v_staff2::text, false);
end $$;

-- un seul projet de vie par beneficiaire
do $$
declare v_ben1 uuid;
begin
  select id into v_ben1 from public.beneficiaires where nom = 'Bamba' limit 1;
  begin
    insert into public.projets_vie (beneficiaire_id, organisation_id, titre)
      values (v_ben1, (select organisation_id from public.beneficiaires where id = v_ben1), 'Autre projet');
    raise exception 'ECHEC: un 2e projet de vie a pu etre cree pour le meme beneficiaire';
  exception
    when unique_violation then
      raise notice 'OK contrainte: un seul projet_vie par beneficiaire';
  end;
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test7.staff2'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.suivis;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit suivis de org1'; end if;
  select count(*) into v_count from public.entretiens;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit entretiens de org1'; end if;
  select count(*) into v_count from public.incidents;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit incidents de org1'; end if;
  select count(*) into v_count from public.projets_vie;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit projets_vie de org1'; end if;
  raise notice 'OK cloisonnement Etape 7: 0 fuite suivis/entretiens/incidents/projets_vie vers staff2 (autre organisation)';
end $$;

reset role;
rollback;
