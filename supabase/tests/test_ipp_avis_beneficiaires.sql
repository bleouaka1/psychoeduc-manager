-- Vérification — avis_beneficiaires + vue_deltas_iga_par_affectation (PLAN_IPP_PROFIL_FORMATEUR.md, T1)
begin;
set role postgres;

do $$
declare
  v_formateur uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
  v_org_tiers uuid;
  v_beneficiaire uuid;
  v_affectation uuid;
  v_membre_organisation uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_formateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testippavis-formateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testippavis-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test IPP Avis', 'solo', v_formateur) returning id into v_org;
  insert into public.organisations (nom, type_organisation, created_by) values ('Org Tiers IPP Avis', 'solo', v_tiers) returning id into v_org_tiers;

  insert into public.beneficiaires (organisation_id, nom, prenoms, date_naissance, statut_beneficiaire, created_by)
    values (v_org, 'Kouassi', 'Amé', current_date - interval '20 years', 'actif', v_formateur) returning id into v_beneficiaire;

  select id into v_membre_organisation from public.membres_organisations where organisation_id = v_org and profile_id = v_formateur;
  insert into public.affectations_personnel (organisation_id, membre_organisation_id, cible_type, cible_id, fonction, date_debut)
    values (v_org, v_membre_organisation, 'beneficiaire', v_beneficiaire, 'Formateur référent', current_date - interval '100 days') returning id into v_affectation;

  insert into public.evaluations_iga (beneficiaire_id, organisation_id, referentiel_version_id, score_global, niveau, date_evaluation, created_by)
    select v_beneficiaire, v_org, id, 30, 'autonomie_emergente', current_date - interval '90 days', v_formateur from public.referentiels_iga where code = 'iga_j' limit 1;
  insert into public.evaluations_iga (beneficiaire_id, organisation_id, referentiel_version_id, score_global, niveau, date_evaluation, created_by)
    select v_beneficiaire, v_org, id, 55, 'autonomie_fonctionnelle', current_date - interval '10 days', v_formateur from public.referentiels_iga where code = 'iga_j' limit 1;

  insert into public.avis_beneficiaires (beneficiaire_id, organisation_id, auteur_type, note, texte, duree_jours_suivi, declencheur, statut, created_by)
    values (v_beneficiaire, v_org, 'beneficiaire', 4, 'Bon accompagnement', 90, 'jalon', 'en_verification', v_formateur);

  perform set_config('t.formateur', v_formateur::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org', v_org::text, false);
  perform set_config('t.beneficiaire', v_beneficiaire::text, false);
  perform set_config('t.affectation', v_affectation::text, false);
end $$;

-- vue_deltas_iga_par_affectation calcule bien debut=30, fin=55
do $$
declare v_debut numeric; v_fin numeric;
begin
  select score_debut, score_fin into v_debut, v_fin from public.vue_deltas_iga_par_affectation where affectation_id = current_setting('t.affectation')::uuid;
  if v_debut <> 30 or v_fin <> 55 then raise exception 'ECHEC: delta IGA incorrect (debut=%, fin=%)', v_debut, v_fin; end if;
  raise notice 'OK: vue_deltas_iga_par_affectation calcule correctement debut=30, fin=55';
end $$;

-- un avis en_verification n'est jamais visible par un tiers
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.avis_beneficiaires where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: un tiers voit un avis en_verification d''un autre formateur'; end if;
  raise notice 'OK cloisonnement: un tiers ne voit pas un avis en_verification d''un autre formateur';
end $$;
reset role;

-- une fois publie, visible de tous
update public.avis_beneficiaires set statut = 'publie' where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.avis_beneficiaires where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: un avis publie n''est pas visible publiquement'; end if;
  raise notice 'OK: un avis publie est visible publiquement, meme par un tiers';
end $$;
reset role;

reset role;
rollback;
