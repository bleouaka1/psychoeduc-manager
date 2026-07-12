-- Vérification — "Devenir bénéficiaire" en self-service (PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md)
begin;
set role postgres;

do $$
declare
  v_formateur uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_formateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testdb-formateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_client, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testdb-client@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testdb-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Devenir Beneficiaire', 'solo', v_formateur) returning id into v_org;

  perform set_config('t.client', v_client::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org', v_org::text, false);
end $$;

-- un compte quelconque (jamais membre de l'organisation) peut créer sa propre fiche bénéficiaire
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.client'), 'role', 'authenticated')::text, false);
do $$
declare v_id uuid;
begin
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire)
    values (current_setting('t.org')::uuid, current_setting('t.client')::uuid, 'Test', 'Client', 'actif')
    returning id into v_id;
  perform set_config('t.beneficiaire', v_id::text, false);
end $$;
reset role;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.beneficiaires where profile_id = current_setting('t.client')::uuid and organisation_id = current_setting('t.org')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le self-service devenir-beneficiaire n''a pas cree la fiche (trouve %)', v_count; end if;
  raise notice 'OK: un compte quelconque peut devenir beneficiaire en self-service (RLS insert etendue)';
end $$;

-- un tiers ne peut pas créer une fiche bénéficiaire AU NOM d'un autre profil
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_erreur boolean := false;
begin
  begin
    insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire)
      values (current_setting('t.org')::uuid, current_setting('t.client')::uuid, 'Usurpation', 'Test', 'actif');
  exception when insufficient_privilege or others then
    v_erreur := true;
  end;
  if not v_erreur then raise exception 'ECHEC: un tiers a pu creer une fiche beneficiaire au nom d''un autre profil'; end if;
  raise notice 'OK: un tiers ne peut pas creer une fiche beneficiaire au nom d''un autre profil (profile_id != auth.uid())';
end $$;
reset role;

reset role;
rollback;
