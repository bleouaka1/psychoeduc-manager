-- Vérification — Espace Parent (PROMPT-CLAUDE-CODE-COMPTE-STRUCTURE-1.md §4.3, étape 7/10)
-- Présences visibles (faits bruts), tendance IGA jamais un score brut, cloisonnement.
begin;
set role postgres;

do $$
declare
  v_directeur uuid := gen_random_uuid();
  v_parent uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
  v_beneficiaire uuid;
  v_referentiel uuid;
  v_classe uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_directeur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testparent-directeur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_parent, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testparent-parent@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testparent-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Ecole Test Espace Parent', 'ecole', v_directeur) returning id into v_org;
  insert into public.beneficiaires (organisation_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org, 'Kouassi', 'Aya', 'actif', v_directeur) returning id into v_beneficiaire;

  insert into public.liens_parent_beneficiaire (organisation_id, parent_profile_id, beneficiaire_id, statut)
    values (v_org, v_parent, v_beneficiaire, 'actif');

  insert into public.classes_groupes (organisation_id, nom, created_by) values (v_org, 'Classe Test Espace Parent', v_directeur) returning id into v_classe;
  insert into public.presences (organisation_id, beneficiaire_id, classe_id, date_seance, statut, created_by)
    values (v_org, v_beneficiaire, v_classe, current_date, 'present', v_directeur);

  select id into v_referentiel from public.referentiels_iga where actif = true limit 1;
  insert into public.evaluations_iga (beneficiaire_id, organisation_id, referentiel_version_id, date_evaluation, score_global, created_by)
    values (v_beneficiaire, v_org, v_referentiel, current_date - 30, 40, v_directeur);
  insert into public.evaluations_iga (beneficiaire_id, organisation_id, referentiel_version_id, date_evaluation, score_global, created_by)
    values (v_beneficiaire, v_org, v_referentiel, current_date, 65, v_directeur);

  perform set_config('t.parent', v_parent::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.beneficiaire', v_beneficiaire::text, false);
end $$;

-- Le parent voit la présence brute de son enfant.
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.parent'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.presences where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le parent ne voit pas la presence de son enfant (count=%)', v_count; end if;
  raise notice 'OK: le parent voit la presence brute de son enfant';
end $$;

-- La tendance renvoie 'progresse' (65 > 40), jamais un score chiffré (le RPC ne renvoie qu'un text).
do $$
declare v_tendance text;
begin
  select public.tendance_iga_enfant(current_setting('t.beneficiaire')::uuid) into v_tendance;
  if v_tendance <> 'progresse' then raise exception 'ECHEC: tendance incorrecte (%), attendu progresse', v_tendance; end if;
  raise notice 'OK: tendance_iga_enfant renvoie "progresse" (65 > 40), jamais un score brut';
end $$;
reset role;

-- Un tiers (aucun lien) ne voit pas la présence, et la fonction renvoie NULL (pas d'erreur,
-- pas de fuite) pour un bénéficiaire auquel il n'est pas lié.
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int; v_tendance text;
begin
  select count(*) into v_count from public.presences where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers voit la presence d''un enfant qui n''est pas le sien'; end if;

  select public.tendance_iga_enfant(current_setting('t.beneficiaire')::uuid) into v_tendance;
  if v_tendance is not null then raise exception 'ECHEC cloisonnement: tendance_iga_enfant renvoie une valeur a un tiers non lie (%)', v_tendance; end if;

  raise notice 'OK cloisonnement: un tiers ne voit ni presence ni tendance pour un enfant qui n''est pas le sien';
end $$;
reset role;

reset role;
rollback;
