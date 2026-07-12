-- Vérification — Capital social bénéficiaire (PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md, Phase 5)
begin;
set role postgres;

do $$
declare
  v_praticien uuid := gen_random_uuid();
  v_b1_user uuid := gen_random_uuid();
  v_b2_user uuid := gen_random_uuid();
  v_tiers_user uuid := gen_random_uuid();
  v_org uuid;
  v_b1 uuid;
  v_b2 uuid;
  v_relation uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_praticien, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testcs-praticien@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_b1_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testcs-b1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_b2_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testcs-b2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testcs-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Capital Social', 'solo', v_praticien) returning id into v_org;
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire, created_by) values (v_org, v_b1_user, 'Kone', 'Aya', 'actif', v_praticien) returning id into v_b1;
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire, created_by) values (v_org, v_b2_user, 'Sanou', 'Karim', 'actif', v_praticien) returning id into v_b2;

  perform set_config('t.b1', v_b1_user::text, false);
  perform set_config('t.b2', v_b2_user::text, false);
  perform set_config('t.tiers', v_tiers_user::text, false);
  perform set_config('t.b1id', v_b1::text, false);
  perform set_config('t.b2id', v_b2::text, false);
  perform set_config('t.org', v_org::text, false);
end $$;

-- b1 propose une relation avec b2 (self-service)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.b1'), 'role', 'authenticated')::text, false);
do $$
declare v_id uuid;
begin
  insert into public.relations_capital_social (beneficiaire_id, organisation_id, type_relation, contact_beneficiaire_id, contexte, demande_par_profile_id)
    values (current_setting('t.b1id')::uuid, current_setting('t.org')::uuid, 'beneficiaire', current_setting('t.b2id')::uuid, 'Cercle Test', current_setting('t.b1')::uuid)
    returning id into v_id;
  perform set_config('t.relation', v_id::text, false);
end $$;
reset role;

-- b2 (la cible) voit la demande en attente et peut la confirmer
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.b2'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.relations_capital_social where id = current_setting('t.relation')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: la cible ne voit pas la demande en attente'; end if;

  update public.relations_capital_social set statut = 'confirmee' where id = current_setting('t.relation')::uuid;
  raise notice 'OK: la cible voit la demande et peut la confirmer';
end $$;
reset role;

-- un tiers ne voit jamais cette relation
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.relations_capital_social where id = current_setting('t.relation')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: un tiers voit une relation dont il ne fait pas partie'; end if;
  raise notice 'OK: un tiers ne voit jamais une relation capital social dont il n''est pas partie';
end $$;
reset role;

-- confirmé côté DB
do $$
declare v_statut text;
begin
  select statut into v_statut from public.relations_capital_social where id = current_setting('t.relation')::uuid;
  if v_statut is distinct from 'confirmee' then raise exception 'ECHEC: statut non confirme (%)', v_statut; end if;
  raise notice 'OK: relation confirmee cote base';
end $$;

reset role;
rollback;
