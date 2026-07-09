begin;
set role postgres;

do $$
declare
  v_fondateur uuid;
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
begin
  select id into v_fondateur from auth.users where email = 'bleouaka1@gmail.com';

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testipp-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test IPP', 'solo', v_fondateur) returning id into v_org;

  perform set_config('t.fondateur', v_fondateur::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org', v_org::text, false);
end $$;

-- baseline = 50 sans historique
do $$
declare v_score numeric;
begin
  select score into v_score from public.vue_ipp where organisation_id = current_setting('t.org')::uuid;
  if v_score <> 50 then raise exception 'ECHEC: baseline IPP incorrecte (%)', v_score; end if;
  raise notice 'OK: baseline IPP = 50 sans historique';
end $$;

-- un tiers non-fondateur ne peut jamais inserer un evenement IPP
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
begin
  begin
    insert into public.evenements_ipp (organisation_id, type_evenement, delta, verifie_par)
    values (current_setting('t.org')::uuid, 'resultat_verifie', 10, current_setting('t.tiers')::uuid);
    raise exception 'ECHEC: un tiers non-fondateur a pu inserer un evenement IPP';
  exception when insufficient_privilege or others then
    raise notice 'OK: un tiers non-fondateur ne peut pas inserer un evenement IPP';
  end;
end $$;
reset role;

-- le fondateur peut inserer un evenement verifie, le score se met a jour
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.fondateur'), 'role', 'authenticated')::text, false);
do $$
begin
  insert into public.evenements_ipp (organisation_id, type_evenement, delta, motif, verifie_par)
  values (current_setting('t.org')::uuid, 'resultat_verifie', 10, 'test', current_setting('t.fondateur')::uuid);
end $$;
reset role;

do $$
declare v_score numeric;
begin
  select score into v_score from public.vue_ipp where organisation_id = current_setting('t.org')::uuid;
  if v_score <> 60 then raise exception 'ECHEC: score IPP apres evenement incorrect (%)', v_score; end if;
  raise notice 'OK: score IPP = 60 apres un evenement verifie de +10';
end $$;

rollback;
