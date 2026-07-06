-- Script de vérification T7 — cloisonnement + checklist sécurité, Étape 5 (bénéficiaires)
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_beneficiaire_user uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_membre_beneficiaire uuid;
  v_ben1 uuid;
  v_ben2_autre uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test5-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test5-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_beneficiaire_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test5-beneficiaire@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A5', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B5', 'structure', v_staff2) returning id into v_org2;

  -- 2 beneficiaires dans org1 : un lie a un compte (mineur avec acces), un autre sans compte
  insert into public.beneficiaires (organisation_id, nom, prenoms, date_naissance, profile_id, created_by)
    values (v_org1, 'Kouassi', 'Aya', '2012-03-15', v_beneficiaire_user, v_staff1) returning id into v_ben1;
  insert into public.beneficiaires (organisation_id, nom, prenoms, date_naissance, created_by)
    values (v_org1, 'Traore', 'Ibrahim', '2011-06-01', v_staff1) returning id into v_ben2_autre;

  -- lie le compte "beneficiaire" a l'organisation (membre + role beneficiaire)
  insert into public.membres_organisations (organisation_id, profile_id, statut, created_by) values (v_org1, v_beneficiaire_user, 'actif', v_staff1) returning id into v_membre_beneficiaire;
  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by) values (v_membre_beneficiaire, 'beneficiaire', v_staff1);

  insert into public.dossiers_beneficiaires (beneficiaire_id, organisation_id, resume_situation, created_by) values (v_ben1, v_org1, 'Suivi test', v_staff1);
  insert into public.parents_tuteurs (beneficiaire_id, organisation_id, nom, lien_parente, created_by) values (v_ben1, v_org1, 'Kouassi Marie', 'mere', v_staff1);

  perform set_config('test5.staff1', v_staff1::text, false);
  perform set_config('test5.staff2', v_staff2::text, false);
  perform set_config('test5.beneficiaire_user', v_beneficiaire_user::text, false);
  perform set_config('test5.org1', v_org1::text, false);
  perform set_config('test5.org2', v_org2::text, false);
  perform set_config('test5.ben1', v_ben1::text, false);
  perform set_config('test5.ben2_autre', v_ben2_autre::text, false);
end $$;

-- test calculer_age (T2)
select public.calculer_age('2012-03-15'::date) as age_test;

set role authenticated;

-- staff2 (organisation B) ne doit rien voir de l'organisation A
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test5.staff2'), 'role', 'authenticated')::text, false);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.beneficiaires where organisation_id = current_setting('test5.org1')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit des beneficiaires de org1'; end if;

  select count(*) into v_count from public.dossiers_beneficiaires;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit des dossiers de org1'; end if;

  select count(*) into v_count from public.parents_tuteurs;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit des parents_tuteurs de org1'; end if;

  raise notice 'OK cloisonnement Etape 5: 0 fuite beneficiaires/dossiers/parents vers staff2 (autre organisation)';
end $$;

-- POINT CRITIQUE SECURITE : le compte "beneficiaire" ne doit voir QUE sa propre fiche, pas celle de l'autre beneficiaire de la meme organisation
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test5.beneficiaire_user'), 'role', 'authenticated')::text, false);

do $$
declare
  v_count int;
  v_ben1 uuid := current_setting('test5.ben1')::uuid;
  v_ben2_autre uuid := current_setting('test5.ben2_autre')::uuid;
begin
  select count(*) into v_count from public.beneficiaires where id = v_ben1;
  if v_count <> 1 then raise exception 'ECHEC: le beneficiaire ne voit pas sa propre fiche'; end if;

  select count(*) into v_count from public.beneficiaires where id = v_ben2_autre;
  if v_count <> 0 then raise exception 'ECHEC SECURITE CRITIQUE: le beneficiaire voit la fiche d''un AUTRE beneficiaire de la meme organisation (fuite de donnees de mineur)'; end if;

  select count(*) into v_count from public.beneficiaires;
  if v_count <> 1 then raise exception 'ECHEC SECURITE CRITIQUE: le beneficiaire voit % fiches au total, attendu exactement 1 (la sienne)', v_count; end if;

  -- ne doit pas non plus voir les dossiers/parents_tuteurs (reserves au personnel)
  select count(*) into v_count from public.dossiers_beneficiaires;
  if v_count <> 0 then raise exception 'ECHEC: le beneficiaire voit dossiers_beneficiaires (reserve au personnel)'; end if;

  raise notice 'OK SECURITE CRITIQUE: le beneficiaire ne voit que sa propre fiche (1/1), aucune fuite vers un autre beneficiaire, aucun acces aux dossiers professionnels';
end $$;

-- acces sans authentification (role anon) : doit etre bloque completement
set role anon;
select set_config('request.jwt.claims', '', false);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.beneficiaires;
  if v_count <> 0 then raise exception 'ECHEC SECURITE CRITIQUE: acces anonyme (non authentifie) voit % beneficiaires', v_count; end if;
  raise notice 'OK SECURITE: aucun acces beneficiaires sans authentification (role anon = 0 ligne)';
exception
  when insufficient_privilege then
    raise notice 'OK SECURITE: acces anonyme rejete par privilege insuffisant';
end $$;

reset role;
rollback;
