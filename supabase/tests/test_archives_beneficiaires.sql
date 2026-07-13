-- Vérification — Archives bénéficiaires (Cockpit Fondateur + Compte Solo) et le
-- correctif log_audit() (organisation_id désormais renseigné pour `beneficiaires`,
-- migration 20260719000000_log_audit_organisation_id_generique.sql).
begin;
set role postgres;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
  v_beneficiaire uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testarchives-admin@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testarchives-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Archives', 'solo', v_admin) returning id into v_org;
  insert into public.membres_organisations (organisation_id, profile_id, statut) values (v_org, v_admin, 'actif')
    on conflict (organisation_id, profile_id) do nothing;
  insert into public.roles_utilisateurs (membre_organisation_id, role, actif)
    select id, 'administrateur', true from public.membres_organisations where organisation_id = v_org and profile_id = v_admin
    on conflict do nothing;

  insert into public.beneficiaires (organisation_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org, 'Diallo', 'Fatou', 'actif', v_admin) returning id into v_beneficiaire;

  -- Suppression directe (simule supprimerBeneficiaireAvecGarde) : déclenche log_audit()
  delete from public.beneficiaires where id = v_beneficiaire;

  perform set_config('t.admin', v_admin::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org', v_org::text, false);
  perform set_config('t.beneficiaire', v_beneficiaire::text, false);
end $$;

-- Le trigger renseigne bien organisation_id (plus NULL) pour une table hors de la
-- liste explicite (organisations/membres_organisations/roles_utilisateurs)
do $$
declare v_org_log uuid;
begin
  select organisation_id into v_org_log from public.audit_logs
  where table_cible = 'beneficiaires' and action = 'DELETE' and ligne_id = current_setting('t.beneficiaire')::uuid;
  if v_org_log is null or v_org_log <> current_setting('t.org')::uuid then
    raise exception 'ECHEC: organisation_id non renseigne (ou incorrect) dans audit_logs pour la suppression du beneficiaire';
  end if;
  raise notice 'OK: organisation_id correctement renseigne dans audit_logs (log_audit generique)';
end $$;

-- Un administrateur de l'organisation voit bien la trace de suppression (audit_logs_select)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.admin'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.audit_logs
  where table_cible = 'beneficiaires' and action = 'DELETE' and ligne_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: un administrateur de l''organisation ne voit pas la suppression dans audit_logs'; end if;
  raise notice 'OK: un administrateur de l''organisation voit la suppression dans audit_logs (correctif RLS effectif)';
end $$;
reset role;

-- Cloisonnement : un tiers hors organisation ne voit pas cette trace
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.audit_logs
  where table_cible = 'beneficiaires' and action = 'DELETE' and ligne_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers hors organisation voit la suppression dans audit_logs'; end if;
  raise notice 'OK cloisonnement: un tiers hors organisation ne voit pas la suppression dans audit_logs';
end $$;
reset role;

reset role;
rollback;
