-- Script de vérification T3 — révocation self-service + cloisonnement, Étape 19
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_ben_user uuid := gen_random_uuid();
  v_autre_ben_user uuid := gen_random_uuid();
  v_org1 uuid;
  v_ben1 uuid;
  v_ben2 uuid;
  v_consentement1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test19-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_ben_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test19-ben1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_autre_ben_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test19-ben2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A19', 'structure', v_staff1) returning id into v_org1;
  insert into public.beneficiaires (organisation_id, nom, prenoms, profile_id, created_by) values (v_org1, 'Kabore', 'Rasmane', v_ben_user, v_staff1) returning id into v_ben1;
  insert into public.beneficiaires (organisation_id, nom, prenoms, profile_id, created_by) values (v_org1, 'Sanogo', 'Nabintou', v_autre_ben_user, v_staff1) returning id into v_ben2;

  insert into public.consentements_donnees (beneficiaire_id, type_consentement, donnee_par_type, donnee_par_id, organisation_id, created_by)
    values (v_ben1, 'temoignage', 'beneficiaire', v_ben_user, v_org1, v_staff1) returning id into v_consentement1;

  perform set_config('test19.ben_user', v_ben_user::text, false);
  perform set_config('test19.autre_ben_user', v_autre_ben_user::text, false);
  perform set_config('test19.consentement1', v_consentement1::text, false);
end $$;

set role authenticated;

-- le beneficiaire titulaire peut revoquer son propre consentement
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test19.ben_user'), 'role', 'authenticated')::text, false);
update public.consentements_donnees set date_revocation = now() where id = current_setting('test19.consentement1')::uuid;
do $$
declare v_rev timestamptz;
begin
  select date_revocation into v_rev from public.consentements_donnees where id = current_setting('test19.consentement1')::uuid;
  if v_rev is null then raise exception 'ECHEC: le beneficiaire titulaire n''a pas pu revoquer son propre consentement'; end if;
  raise notice 'OK: le beneficiaire titulaire peut revoquer son propre consentement (self-service)';
end $$;

-- un AUTRE beneficiaire ne peut ni voir ni modifier ce consentement
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test19.autre_ben_user'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.consentements_donnees where id = current_setting('test19.consentement1')::uuid;
  if v_count <> 0 then raise exception 'ECHEC SECURITE: un autre beneficiaire voit le consentement de quelqu''un d''autre'; end if;
  raise notice 'OK SECURITE: un consentement n''est visible que par son titulaire (ou le personnel habilite)';
end $$;

reset role;
rollback;
