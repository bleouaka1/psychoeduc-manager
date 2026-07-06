-- Script de vérification T2 — lecture ouverte / écriture fondateur, Étape 25
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_org1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test25-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A25', 'structure', v_staff1) returning id into v_org1;

  insert into public.parametres_securite (cle, valeur) values ('duree_session_minutes', '60');

  perform set_config('test25.staff1', v_staff1::text, false);
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test25.staff1'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.parametres_securite where cle = 'duree_session_minutes';
  if v_count <> 1 then raise exception 'ECHEC: un non-fondateur ne peut pas lire un parametre (attendu lecture ouverte)'; end if;
  raise notice 'OK: lecture des parametres ouverte a tout authentifie';

  begin
    insert into public.parametres_securite (cle, valeur) values ('tentative_frauduleuse', '1');
    raise exception 'ECHEC SECURITE: un non-fondateur a pu ecrire un parametre de securite';
  exception
    when insufficient_privilege or others then
      raise notice 'OK SECURITE: ecriture des parametres reservee au fondateur';
  end;
end $$;

reset role;
rollback;
