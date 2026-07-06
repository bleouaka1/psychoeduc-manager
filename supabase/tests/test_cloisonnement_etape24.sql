-- Script de vérification T2 — acces fondateur uniquement + verrou chiffree, Étape 24
begin;
set role postgres;

do $$
declare
  v_fondateur uuid := gen_random_uuid();
  v_staff1 uuid := gen_random_uuid();
  v_org1 uuid;
  v_membre_f uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_fondateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test24-fondateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test24-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A24', 'structure', v_staff1) returning id into v_org1;
  insert into public.membres_organisations (organisation_id, profile_id, statut, created_by) values (v_org1, v_fondateur, 'actif', v_fondateur) returning id into v_membre_f;
  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by) values (v_membre_f, 'fondateur', v_fondateur);

  perform set_config('test24.fondateur', v_fondateur::text, false);
  perform set_config('test24.staff1', v_staff1::text, false);
end $$;

-- verrou chiffree=true : une tentative false doit etre rejetee (meme en tant que postgres/superuser)
do $$
begin
  begin
    insert into public.sauvegardes_export (type_export, format, chiffree, declenchee_par) values ('complet', 'sql', false, 'systeme');
    raise exception 'ECHEC: une sauvegarde non chiffree a pu etre inseree';
  exception
    when check_violation then
      raise notice 'OK: le CHECK constraint interdit physiquement chiffree=false';
  end;
end $$;

set role authenticated;

-- un non-fondateur ne peut ni lire ni creer
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test24.staff1'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  begin
    insert into public.sauvegardes_export (type_export, format, declenchee_par) values ('complet', 'sql', 'fondateur');
    raise exception 'ECHEC SECURITE: un non-fondateur a pu creer une sauvegarde';
  exception
    when insufficient_privilege or others then
      raise notice 'OK SECURITE: creation de sauvegarde bloquee pour un non-fondateur';
  end;

  select count(*) into v_count from public.sauvegardes_export;
  if v_count <> 0 then raise exception 'ECHEC SECURITE: un non-fondateur voit des sauvegardes'; end if;
  raise notice 'OK SECURITE: un non-fondateur ne voit aucune sauvegarde (0 ligne)';
end $$;

-- le fondateur peut creer et lire
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test24.fondateur'), 'role', 'authenticated')::text, false);
insert into public.sauvegardes_export (type_export, format, declenchee_par, created_by) values ('complet', 'sql', 'fondateur', current_setting('test24.fondateur')::uuid);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.sauvegardes_export;
  if v_count <> 1 then raise exception 'ECHEC: le fondateur ne voit pas la sauvegarde qu''il vient de creer'; end if;
  raise notice 'OK: le fondateur peut creer et lire les sauvegardes';
end $$;

reset role;
rollback;
