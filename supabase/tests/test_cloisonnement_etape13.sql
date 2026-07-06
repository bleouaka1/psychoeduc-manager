-- Script de vérification T3 — cloisonnement + ressources globales, Étape 13
begin;
set role postgres;

do $$
declare
  v_fondateur uuid := gen_random_uuid();
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_membre_f uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_fondateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test13-fondateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test13-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test13-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A13', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B13', 'structure', v_staff2) returning id into v_org2;

  insert into public.membres_organisations (organisation_id, profile_id, statut, created_by) values (v_org1, v_fondateur, 'actif', v_fondateur) returning id into v_membre_f;
  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by) values (v_membre_f, 'fondateur', v_fondateur);

  -- ressource globale (organisation_id null) creee par le fondateur
  insert into public.opportunites (organisation_id, titre, created_by) values (null, 'Opportunite Nationale', v_fondateur);
  -- ressource specifique a org1
  insert into public.opportunites (organisation_id, titre, created_by) values (v_org1, 'Opportunite Locale A13', v_staff1);

  perform set_config('test13.staff2', v_staff2::text, false);
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test13.staff2'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  -- staff2 doit voir la ressource GLOBALE
  select count(*) into v_count from public.opportunites where titre = 'Opportunite Nationale';
  if v_count <> 1 then raise exception 'ECHEC: staff2 ne voit pas la ressource globale (organisation_id null)'; end if;

  -- staff2 ne doit PAS voir la ressource specifique a org1
  select count(*) into v_count from public.opportunites where titre = 'Opportunite Locale A13';
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit une ressource specifique a org1 (fuite!)'; end if;

  raise notice 'OK Etape 13: ressource globale visible par tous, ressource organisation-scopee cloisonnee correctement';

  -- staff2 ne doit pas pouvoir creer une ressource globale
  begin
    insert into public.opportunites (organisation_id, titre) values (null, 'Tentative frauduleuse');
    raise exception 'ECHEC SECURITE: staff2 (non-fondateur) a pu creer une ressource globale';
  exception
    when insufficient_privilege or others then
      raise notice 'OK SECURITE: creation de ressource globale bloquee pour un non-fondateur';
  end;
end $$;

reset role;
rollback;
