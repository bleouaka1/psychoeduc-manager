-- Script de vérification T4 — vue_reussites filtree, isolation vue_dashboard_fondateur, Étape 23
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_ben1 uuid;
  v_ref_id uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test23-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test23-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A23', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B23', 'structure', v_staff2) returning id into v_org2;

  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'Zongo', 'Alain', v_staff1) returning id into v_ben1;
  select id into v_ref_id from public.referentiels_iga where actif = true;

  -- une reussite PROPOSEE (ne doit pas compter) et une CONFIRMEE (doit compter)
  insert into public.reussites_beneficiaires (beneficiaire_id, statut, organisation_id) values (v_ben1, 'proposee_systeme', v_org1);
  insert into public.reussites_beneficiaires (beneficiaire_id, statut, organisation_id, confirmee_par, date_confirmation) values (v_ben1, 'confirmee', v_org1, v_staff1, now());

  perform set_config('test23.staff1', v_staff1::text, false);
  perform set_config('test23.staff2', v_staff2::text, false);
  perform set_config('test23.org1', v_org1::text, false);
end $$;

-- vue_reussites ne contient que la confirmee (pas la proposee)
do $$
declare v_count int;
begin
  select count(*) into v_count from public.vue_reussites where organisation_id = current_setting('test23.org1')::uuid;
  if v_count <> 1 then raise exception 'ECHEC vue_reussites: % lignes au lieu de 1 (la confirmee uniquement)', v_count; end if;
  raise notice 'OK vue_reussites: ne compte que les reussites confirmees (1), pas les proposees';
end $$;

-- staff1 (org1) voit un total_organisations=1 dans son perimetre RLS ; staff2 (org2) aussi voit 1 (le sien)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test23.staff1'), 'role', 'authenticated')::text, false);
do $$
declare v_total int;
begin
  select total_organisations into v_total from public.vue_dashboard_fondateur;
  if v_total <> 1 then raise exception 'ECHEC isolation vue_dashboard_fondateur: staff1 voit % organisations au lieu de 1 (la sienne)', v_total; end if;
  raise notice 'OK isolation vue_dashboard_fondateur: staff1 (non-fondateur) ne voit que sa propre organisation dans le total (1), pas la plateforme entiere';
end $$;

reset role;
rollback;
