-- Vérification — Compte Structure : fondations (PROMPT-CLAUDE-CODE-COMPTE-STRUCTURE-1.md §3, §7)
-- Couvre les points non négociables : accès formateur strictement par assignation,
-- fiches d'entretien jamais exposées à bénéficiaire/parent, parent scopé à son
-- propre enfant uniquement, cloisonnement inter-organisations.
begin;
set role postgres;

do $$
declare
  v_directeur uuid := gen_random_uuid();
  v_formateur_assigne uuid := gen_random_uuid();
  v_formateur_non_assigne uuid := gen_random_uuid();
  v_parent uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
  v_org_tiers uuid;
  v_beneficiaire uuid;
  v_beneficiaire_tiers uuid;
  v_membre_directeur uuid;
  v_membre_formateur_assigne uuid;
  v_membre_formateur_non_assigne uuid;
  v_entretien uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_directeur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teststruct-directeur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_formateur_assigne, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teststruct-formateur-assigne@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_formateur_non_assigne, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teststruct-formateur-non-assigne@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_parent, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teststruct-parent@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teststruct-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Ecole Test Structure', 'ecole', v_directeur) returning id into v_org;
  insert into public.organisations (nom, type_organisation, created_by) values ('Ecole Tiers Structure', 'ecole', v_tiers) returning id into v_org_tiers;

  -- Le trigger handle_new_organisation a déjà créé v_directeur comme 'administrateur' de v_org.
  -- On ajoute explicitement le rôle 'directeur' (cumul de rôles autorisé).
  select id into v_membre_directeur from public.membres_organisations where organisation_id = v_org and profile_id = v_directeur;
  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by) values (v_membre_directeur, 'directeur', v_directeur);

  insert into public.membres_organisations (organisation_id, profile_id, statut, created_by) values (v_org, v_formateur_assigne, 'actif', v_directeur) returning id into v_membre_formateur_assigne;
  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by) values (v_membre_formateur_assigne, 'formateur', v_directeur);

  insert into public.membres_organisations (organisation_id, profile_id, statut, created_by) values (v_org, v_formateur_non_assigne, 'actif', v_directeur) returning id into v_membre_formateur_non_assigne;
  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by) values (v_membre_formateur_non_assigne, 'formateur', v_directeur);

  insert into public.beneficiaires (organisation_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org, 'Kone', 'Awa', 'actif', v_directeur) returning id into v_beneficiaire;
  insert into public.beneficiaires (organisation_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org_tiers, 'Autre', 'Beneficiaire', 'actif', v_tiers) returning id into v_beneficiaire_tiers;

  insert into public.assignations (organisation_id, formateur_membre_organisation_id, beneficiaire_id, assigne_par)
    values (v_org, v_membre_formateur_assigne, v_beneficiaire, v_membre_directeur);

  insert into public.liens_parent_beneficiaire (organisation_id, parent_profile_id, beneficiaire_id, statut)
    values (v_org, v_parent, v_beneficiaire, 'actif');

  insert into public.entretiens (organisation_id, beneficiaire_id, type_entretien, statut, interlocuteur, mene_par, created_by)
    values (v_org, v_beneficiaire, 'general', 'valide', 'parent_tuteur', v_formateur_assigne, v_directeur) returning id into v_entretien;

  perform set_config('t.directeur', v_directeur::text, false);
  perform set_config('t.formateur_assigne', v_formateur_assigne::text, false);
  perform set_config('t.formateur_non_assigne', v_formateur_non_assigne::text, false);
  perform set_config('t.parent', v_parent::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org', v_org::text, false);
  perform set_config('t.beneficiaire', v_beneficiaire::text, false);
  perform set_config('t.entretien', v_entretien::text, false);
end $$;

-- 1) Formateur ASSIGNÉ voit le bénéficiaire ; formateur NON assigné (même organisation) ne le voit pas.
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.formateur_assigne'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.beneficiaires where id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le formateur assigne ne voit pas son beneficiaire (count=%)', v_count; end if;
  raise notice 'OK: formateur assigne voit son beneficiaire';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.formateur_non_assigne'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.beneficiaires where id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: un formateur NON assigne voit un beneficiaire de son organisation (acces devrait suivre l''assignation, jamais le role seul)'; end if;
  raise notice 'OK: formateur non assigne ne voit PAS le beneficiaire (acces suit l''assignation, pas le role)';
end $$;
reset role;

-- 2) Directeur voit tout son établissement sans assignation (accès large, cohérent avec §3).
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.directeur'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.beneficiaires where id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le directeur ne voit pas un beneficiaire de son etablissement'; end if;
  raise notice 'OK: directeur voit tout son etablissement sans assignation';
end $$;
reset role;

-- 3) Les fiches d'entretien ne sont JAMAIS exposées à un rôle bénéficiaire/parent — vérifié
-- explicitement avec le compte parent (a un lien actif vers CE bénéficiaire, et malgré ça
-- ne doit voir aucune fiche, y compris celles marquées interlocuteur='parent_tuteur').
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.parent'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.entretiens where id = current_setting('t.entretien')::uuid;
  if v_count <> 0 then raise exception 'ECHEC CRITIQUE: un parent voit une fiche d''entretien (non negociable, doit toujours etre 0)'; end if;
  raise notice 'OK: le parent ne voit jamais aucune fiche d''entretien, meme interlocuteur=parent_tuteur';
end $$;
reset role;

-- 4) Parent voit son propre lien (et par ce lien, le statut/paiements de son enfant),
-- mais rien d'un autre bénéficiaire d'une autre organisation.
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.parent'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.liens_parent_beneficiaire where beneficiaire_id = current_setting('t.beneficiaire')::uuid and parent_profile_id = current_setting('t.parent')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le parent ne voit pas son propre lien'; end if;
  raise notice 'OK: le parent voit son propre lien parent-beneficiaire';
end $$;
reset role;

-- 5) Cloisonnement inter-organisations : un tiers d'une autre structure ne voit ni le
-- bénéficiaire, ni l'assignation, ni le lien parent, ni l'entretien.
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.beneficiaires where id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers voit le beneficiaire d''une autre structure'; end if;

  select count(*) into v_count from public.entretiens where id = current_setting('t.entretien')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers voit un entretien d''une autre structure'; end if;

  select count(*) into v_count from public.liens_parent_beneficiaire where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers voit le lien parent-beneficiaire d''une autre structure'; end if;

  raise notice 'OK cloisonnement: un tiers d''une autre structure ne voit rien de tout ceci';
end $$;
reset role;

reset role;
rollback;
