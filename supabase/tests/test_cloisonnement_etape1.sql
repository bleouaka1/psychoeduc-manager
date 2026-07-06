-- Script de vérification T14 — cloisonnement multi-organisations, Étape 1
-- Non destiné à être committé comme migration : test ponctuel, exécuté puis ROLLBACK.
begin;
set role postgres;

do $$
declare
  v_user1 uuid := gen_random_uuid();
  v_user2 uuid := gen_random_uuid();
  v_user_fondateur uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_membre_fondateur uuid;
  v_count int;
begin
  -- création des 3 comptes de test
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_user1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-org1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_user2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-org2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_user_fondateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-fondateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  -- vérifie que le trigger on_auth_user_created a bien créé les profils
  select count(*) into v_count from public.profiles where id in (v_user1, v_user2, v_user_fondateur);
  if v_count <> 3 then
    raise exception 'ECHEC T3: % profils crees au lieu de 3 attendus', v_count;
  end if;
  raise notice 'OK T3: 3 profils crees automatiquement via trigger';

  -- création de 2 organisations, chacune par son créateur (déclenche handle_new_organisation)
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A', 'structure', v_user1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B', 'structure', v_user2) returning id into v_org2;

  -- vérifie le bootstrap auto (membre + role administrateur)
  select count(*) into v_count from public.membres_organisations mo
    join public.roles_utilisateurs ru on ru.membre_organisation_id = mo.id
    where mo.organisation_id = v_org1 and mo.profile_id = v_user1 and ru.role = 'administrateur' and ru.actif;
  if v_count <> 1 then
    raise exception 'ECHEC T9/bootstrap: createur org1 n''a pas recu le role administrateur automatiquement';
  end if;
  raise notice 'OK bootstrap: createur auto-membre + administrateur de sa propre organisation';

  -- promotion manuelle du 3e compte en fondateur (accès plateforme global)
  insert into public.membres_organisations (organisation_id, profile_id, statut, created_by) values (v_org1, v_user_fondateur, 'actif', v_user_fondateur) returning id into v_membre_fondateur;
  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by) values (v_membre_fondateur, 'fondateur', v_user_fondateur);

  -- stocke les ids dans des GUC personnalisees pour les récupérer hors du bloc DO
  perform set_config('test.user1', v_user1::text, false);
  perform set_config('test.user2', v_user2::text, false);
  perform set_config('test.user_fondateur', v_user_fondateur::text, false);
  perform set_config('test.org1', v_org1::text, false);
  perform set_config('test.org2', v_org2::text, false);
end $$;

-- ============================================================================
-- Bascule en utilisateur "authenticated" = user1, simulate le JWT via la GUC
-- ============================================================================
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user1'), 'role', 'authenticated')::text, false);

do $$
declare
  v_count int;
  v_org1 uuid := current_setting('test.org1')::uuid;
  v_org2 uuid := current_setting('test.org2')::uuid;
begin
  -- user1 ne doit voir que son organisation
  select count(*) into v_count from public.organisations;
  if v_count <> 1 then raise exception 'ECHEC cloisonnement: user1 voit % organisations au lieu de 1', v_count; end if;

  select count(*) into v_count from public.organisations where id = v_org2;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: user1 voit l''organisation B (fuite!)'; end if;

  select count(*) into v_count from public.membres_organisations where organisation_id = v_org2;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: user1 voit les membres de l''organisation B (fuite!)'; end if;

  raise notice 'OK cloisonnement SELECT: user1 ne voit que son organisation (A), 0 fuite vers B';
end $$;

-- tentative d'écriture croisée : user1 essaie de modifier l'organisation B
update public.organisations set nom = 'HACKED' where id = current_setting('test.org2')::uuid;
do $$
declare
  v_affected int;
begin
  get diagnostics v_affected = row_count;
  if v_affected <> 0 then
    raise exception 'ECHEC cloisonnement: UPDATE croise sur organisation B a reussi (% lignes)', v_affected;
  end if;
  raise notice 'OK cloisonnement UPDATE: écriture croisée sur organisation B bloquée (0 ligne affectée)';
end $$;

-- tentative : user1 essaie de s'auto-ajouter comme membre de l'organisation B
do $$
begin
  begin
    insert into public.membres_organisations (organisation_id, profile_id, statut)
    values (current_setting('test.org2')::uuid, current_setting('test.user1')::uuid, 'actif');
    raise exception 'ECHEC cloisonnement: user1 a reussi a s''auto-ajouter a l''organisation B';
  exception
    when insufficient_privilege or others then
      raise notice 'OK cloisonnement INSERT: auto-ajout de user1 a l''organisation B bloqué par RLS';
  end;
end $$;

-- ============================================================================
-- Bascule en utilisateur "authenticated" = user2, vérification symétrique
-- ============================================================================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user2'), 'role', 'authenticated')::text, false);

do $$
declare
  v_count int;
  v_org1 uuid := current_setting('test.org1')::uuid;
begin
  select count(*) into v_count from public.organisations where id = v_org1;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement symetrique: user2 voit l''organisation A (fuite!)'; end if;
  raise notice 'OK cloisonnement symetrique: user2 ne voit pas l''organisation A';
end $$;

-- ============================================================================
-- Bascule en fondateur : doit tout voir
-- ============================================================================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_fondateur'), 'role', 'authenticated')::text, false);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.organisations;
  if v_count <> 2 then raise exception 'ECHEC acces global fondateur: voit % organisations au lieu de 2', v_count; end if;
  raise notice 'OK acces global fondateur: voit les 2 organisations';
end $$;

-- ============================================================================
-- Vérification append-only sur audit_logs (même le fondateur ne peut ni UPDATE ni DELETE)
-- ============================================================================
do $$
begin
  begin
    update public.audit_logs set action = 'TAMPERED' where true;
    raise exception 'ECHEC append-only: UPDATE sur audit_logs a reussi';
  exception
    when insufficient_privilege or others then
      raise notice 'OK append-only: UPDATE sur audit_logs bloqué (aucune policy d''ecriture)';
  end;

  begin
    delete from public.audit_logs where true;
    raise exception 'ECHEC append-only: DELETE sur audit_logs a reussi';
  exception
    when insufficient_privilege or others then
      raise notice 'OK append-only: DELETE sur audit_logs bloqué (aucune policy d''ecriture)';
  end;
end $$;

reset role;
rollback;
