-- Vérification — ICC (Indice de Compétences du Bénéficiaire) (PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md, Phase 3)
begin;
set role postgres;

do $$
declare
  v_praticien uuid := gen_random_uuid();
  v_beneficiaire_user uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
  v_formation uuid;
  v_beneficiaire uuid;
  v_competence_savoir uuid;
  v_competence_savoir_faire uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_praticien, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testicc-praticien@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_beneficiaire_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testicc-beneficiaire@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testicc-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test ICC', 'solo', v_praticien) returning id into v_org;
  insert into public.formations (organisation_id, titre, created_by) values (v_org, 'Menuiserie E2E', v_praticien) returning id into v_formation;
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org, v_beneficiaire_user, 'Sanogo', 'Ibrahim', 'actif', v_praticien) returning id into v_beneficiaire;

  insert into public.icc_competences (formation_id, organisation_id, type, libelle, created_by)
    values (v_formation, v_org, 'savoir', 'Connaît les essences de bois', v_praticien) returning id into v_competence_savoir;
  insert into public.icc_competences (formation_id, organisation_id, type, libelle, created_by)
    values (v_formation, v_org, 'savoir_faire', 'Manier une scie électrique', v_praticien) returning id into v_competence_savoir_faire;

  insert into public.icc_evaluations_savoir (competence_id, beneficiaire_id, organisation_id, moment, maitrise, evalue_par)
    values (v_competence_savoir, v_beneficiaire, v_org, 'avant', false, v_praticien);
  insert into public.icc_evaluations_savoir (competence_id, beneficiaire_id, organisation_id, moment, maitrise, evalue_par)
    values (v_competence_savoir, v_beneficiaire, v_org, 'apres', true, v_praticien);
  insert into public.icc_evaluations_savoir_faire (competence_id, beneficiaire_id, organisation_id, niveau, evalue_par)
    values (v_competence_savoir_faire, v_beneficiaire, v_org, 'autonome', v_praticien);
  insert into public.icc_observations_savoir_etre (beneficiaire_id, formation_id, organisation_id, tag, evalue_par)
    values (v_beneficiaire, v_formation, v_org, 'Ponctualité', v_praticien);

  perform set_config('t.beneficiaire_user', v_beneficiaire_user::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.beneficiaire', v_beneficiaire::text, false);
  perform set_config('t.formation', v_formation::text, false);
  perform set_config('t.competence_savoir', v_competence_savoir::text, false);
  perform set_config('t.competence_savoir_faire', v_competence_savoir_faire::text, false);
end $$;

-- unique(competence_id, beneficiaire_id, moment) : une deuxieme evaluation "apres" ecrase
-- la premiere via upsert, jamais un doublon (verifie ici par violation attendue sur un insert brut)
do $$
declare v_erreur boolean := false;
begin
  begin
    insert into public.icc_evaluations_savoir (competence_id, beneficiaire_id, organisation_id, moment, maitrise)
      select current_setting('t.competence_savoir')::uuid, current_setting('t.beneficiaire')::uuid, organisation_id, 'apres', false
      from public.icc_competences where id = current_setting('t.competence_savoir')::uuid;
  exception when unique_violation then
    v_erreur := true;
  end;
  if not v_erreur then raise exception 'ECHEC: la contrainte unique(competence_id,beneficiaire_id,moment) n''est pas appliquee'; end if;
  raise notice 'OK: contrainte unique respectee sur icc_evaluations_savoir (competence_id, beneficiaire_id, moment)';
end $$;

-- le beneficiaire lit ses propres competences/evaluations/observations
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.beneficiaire_user'), 'role', 'authenticated')::text, false);
do $$
declare v_count_competences int; v_count_savoir int; v_count_savoir_faire int; v_count_obs int;
begin
  select count(*) into v_count_competences from public.icc_competences where formation_id = current_setting('t.formation')::uuid;
  select count(*) into v_count_savoir from public.icc_evaluations_savoir where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  select count(*) into v_count_savoir_faire from public.icc_evaluations_savoir_faire where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  select count(*) into v_count_obs from public.icc_observations_savoir_etre where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count_competences <> 2 then raise exception 'ECHEC: le beneficiaire ne voit pas les 2 competences de sa formation (trouve %)', v_count_competences; end if;
  if v_count_savoir <> 2 then raise exception 'ECHEC: le beneficiaire ne voit pas ses 2 evaluations savoir (trouve %)', v_count_savoir; end if;
  if v_count_savoir_faire <> 1 then raise exception 'ECHEC: le beneficiaire ne voit pas son evaluation savoir-faire (trouve %)', v_count_savoir_faire; end if;
  if v_count_obs <> 1 then raise exception 'ECHEC: le beneficiaire ne voit pas son observation savoir-etre (trouve %)', v_count_obs; end if;
  raise notice 'OK: le beneficiaire voit ses propres competences/evaluations/observations ICC';
end $$;
reset role;

-- un tiers ne voit rien de tout ca
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.icc_evaluations_savoir where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: un tiers voit les evaluations ICC d''un autre beneficiaire'; end if;
  select count(*) into v_count from public.icc_competences where formation_id = current_setting('t.formation')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: un tiers voit les competences ICC d''une formation qui ne le concerne pas'; end if;
  raise notice 'OK: un tiers ne voit ni les competences ni les evaluations ICC d''un autre beneficiaire';
end $$;
reset role;

reset role;
rollback;
