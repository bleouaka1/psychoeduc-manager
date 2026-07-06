-- Script de vérification — inscriptions/progression/certificat auto, cloisonnement, marketplace publique
begin;
set role postgres;

do $$
declare
  v_formateur uuid := gen_random_uuid();
  v_acheteur uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org_solo uuid;
  v_formation uuid;
  v_cours1 uuid;
  v_cours2 uuid;
  v_inscription uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_formateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testsolo-formateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_acheteur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testsolo-acheteur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testsolo-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Solo Test Formateur', 'solo', v_formateur) returning id into v_org_solo;

  insert into public.formations (organisation_id, titre, mode_transmission, prix, statut, created_by)
    values (v_org_solo, 'Gestion des emotions', 'video_tutoriel', 15000, 'publiee', v_formateur) returning id into v_formation;

  insert into public.cours (formation_id, organisation_id, titre, ordre, created_by) values (v_formation, v_org_solo, 'Module 1', 1, v_formateur) returning id into v_cours1;
  insert into public.cours (formation_id, organisation_id, titre, ordre, created_by) values (v_formation, v_org_solo, 'Module 2', 2, v_formateur) returning id into v_cours2;

  insert into public.inscriptions_formations (formation_id, acheteur_id, organisation_id) values (v_formation, v_acheteur, v_org_solo) returning id into v_inscription;

  perform set_config('testsolo.formateur', v_formateur::text, false);
  perform set_config('testsolo.acheteur', v_acheteur::text, false);
  perform set_config('testsolo.tiers', v_tiers::text, false);
  perform set_config('testsolo.org_solo', v_org_solo::text, false);
  perform set_config('testsolo.formation', v_formation::text, false);
  perform set_config('testsolo.cours1', v_cours1::text, false);
  perform set_config('testsolo.cours2', v_cours2::text, false);
  perform set_config('testsolo.inscription', v_inscription::text, false);
end $$;

-- vue_marketplace_formations expose bien la formation publiee
do $$
declare v_count int;
begin
  select count(*) into v_count from public.vue_marketplace_formations where id = current_setting('testsolo.formation')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: vue_marketplace_formations ne montre pas la formation publiee'; end if;
  raise notice 'OK: vue_marketplace_formations expose la formation publiee (vue, pas de table dupliquee)';
end $$;

-- progression partielle (1/2 cours) : inscription reste en_cours, pas de certificat
insert into public.progression_formation (inscription_id, cours_id, complete, date_completion)
  values (current_setting('testsolo.inscription')::uuid, current_setting('testsolo.cours1')::uuid, true, now());

do $$
declare v_statut text; v_cert int;
begin
  select statut into v_statut from public.inscriptions_formations where id = current_setting('testsolo.inscription')::uuid;
  select count(*) into v_cert from public.certificats where inscription_id = current_setting('testsolo.inscription')::uuid;
  if v_statut <> 'en_cours' then raise exception 'ECHEC: inscription passee a % avec seulement 1/2 cours completes', v_statut; end if;
  if v_cert <> 0 then raise exception 'ECHEC: certificat delivre prematurement (1/2 cours)'; end if;
  raise notice 'OK: progression partielle (1/2) ne declenche ni fin ni certificat';
end $$;

-- progression complete (2/2 cours) : auto-completion + certificat
insert into public.progression_formation (inscription_id, cours_id, complete, date_completion)
  values (current_setting('testsolo.inscription')::uuid, current_setting('testsolo.cours2')::uuid, true, now());

do $$
declare v_statut text; v_cert int;
begin
  select statut into v_statut from public.inscriptions_formations where id = current_setting('testsolo.inscription')::uuid;
  select count(*) into v_cert from public.certificats where inscription_id = current_setting('testsolo.inscription')::uuid;
  if v_statut <> 'termine' then raise exception 'ECHEC auto-completion: statut=% attendu termine', v_statut; end if;
  if v_cert <> 1 then raise exception 'ECHEC: certificat non delivre automatiquement a 100%%'; end if;
  raise notice 'OK: progression complete (2/2) declenche automatiquement statut=termine + certificat';
end $$;

-- cloisonnement : un tiers ne voit ni l'inscription ni le certificat
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('testsolo.tiers'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.inscriptions_formations where id = current_setting('testsolo.inscription')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers voit l''inscription d''un autre'; end if;
  select count(*) into v_count from public.certificats where inscription_id = current_setting('testsolo.inscription')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers voit le certificat d''un autre'; end if;
  raise notice 'OK cloisonnement: un tiers ne voit ni l''inscription ni le certificat d''autrui';
end $$;

-- l'acheteur titulaire voit bien son inscription et son certificat
select set_config('request.jwt.claims', json_build_object('sub', current_setting('testsolo.acheteur'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.inscriptions_formations where id = current_setting('testsolo.inscription')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: l''acheteur ne voit pas sa propre inscription'; end if;
  select count(*) into v_count from public.certificats where inscription_id = current_setting('testsolo.inscription')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: l''acheteur ne voit pas son propre certificat'; end if;
  raise notice 'OK: l''acheteur voit sa propre inscription et son certificat';
end $$;

reset role;
rollback;
