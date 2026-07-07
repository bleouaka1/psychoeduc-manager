-- Vérification — Messagerie directe WhatsApp/Email (PLAN_MESSAGERIE_BENEFICIAIRES.md, tâche T3)
-- Résolution des 3 catégories de contact (bénéficiaire/parent-tuteur/formateur-responsable
-- via affectations_personnel) + cloisonnement inter-organisations + colonne mode_whatsapp_defaut.
begin;
set role postgres;

do $$
declare
  v_formateur uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
  v_org_tiers uuid;
  v_beneficiaire uuid;
  v_membre_organisation uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_formateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testmsg-formateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testmsg-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  update public.profiles set telephone = '+225 07 00 00 00 01', email = 'formateur.msg@example.test' where id = v_formateur;

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Messagerie', 'solo', v_formateur) returning id into v_org;
  insert into public.organisations (nom, type_organisation, created_by) values ('Org Tiers Messagerie', 'solo', v_tiers) returning id into v_org_tiers;

  insert into public.beneficiaires (organisation_id, nom, prenoms, telephone, email, statut_beneficiaire, created_by)
    values (v_org, 'Kouassi', 'Amé', '+225 01 02 03 04', 'ame.kouassi@example.test', 'actif', v_formateur) returning id into v_beneficiaire;

  insert into public.parents_tuteurs (beneficiaire_id, organisation_id, nom, prenoms, lien_parente, telephone, email)
    values (v_beneficiaire, v_org, 'Kouassi', 'Jean', 'pere', '+225 05 06 07 08', 'jean.kouassi@example.test');

  select id into v_membre_organisation from public.membres_organisations where organisation_id = v_org and profile_id = v_formateur;
  insert into public.affectations_personnel (organisation_id, membre_organisation_id, cible_type, cible_id, fonction)
    values (v_org, v_membre_organisation, 'beneficiaire', v_beneficiaire, 'Formateur référent');

  perform set_config('t.formateur', v_formateur::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org', v_org::text, false);
  perform set_config('t.beneficiaire', v_beneficiaire::text, false);
end $$;

-- Le mode WhatsApp par defaut est 'lien_simple' pour toute organisation (valeur par defaut de la colonne)
do $$
declare v_mode text;
begin
  select mode_whatsapp_defaut into v_mode from public.organisations where id = current_setting('t.org')::uuid;
  if v_mode <> 'lien_simple' then raise exception 'ECHEC: mode_whatsapp_defaut par defaut incorrect (%)', v_mode; end if;
  raise notice 'OK: mode_whatsapp_defaut par defaut = lien_simple';
end $$;

-- La contrainte check rejette une valeur hors enum
do $$
begin
  begin
    update public.organisations set mode_whatsapp_defaut = 'autre_chose' where id = current_setting('t.org')::uuid;
    raise exception 'ECHEC: la contrainte check aurait du rejeter une valeur invalide';
  exception when check_violation then
    raise notice 'OK: contrainte check rejette une valeur de mode_whatsapp_defaut invalide';
  end;
end $$;

-- Resolution des 3 categories de contact pour le formateur proprietaire (RLS authenticated)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.formateur'), 'role', 'authenticated')::text, false);
do $$
declare
  v_tel_beneficiaire text;
  v_tel_parent text;
  v_nb_affectations int;
begin
  select telephone into v_tel_beneficiaire from public.beneficiaires where id = current_setting('t.beneficiaire')::uuid;
  if v_tel_beneficiaire <> '+225 01 02 03 04' then raise exception 'ECHEC: telephone beneficiaire non lisible par le proprietaire'; end if;

  select telephone into v_tel_parent from public.parents_tuteurs where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_tel_parent <> '+225 05 06 07 08' then raise exception 'ECHEC: telephone parent/tuteur non lisible par le proprietaire'; end if;

  select count(*) into v_nb_affectations from public.affectations_personnel
    where cible_type = 'beneficiaire' and cible_id = current_setting('t.beneficiaire')::uuid and statut = 'active';
  if v_nb_affectations <> 1 then raise exception 'ECHEC: affectation formateur/responsable non resolue (count=%)', v_nb_affectations; end if;

  raise notice 'OK: les 3 categories de contact (beneficiaire/parent-tuteur/formateur-responsable) sont resolues pour le proprietaire';
end $$;
reset role;

-- Cloisonnement : un tiers d'une autre organisation ne voit ni le beneficiaire, ni le parent/tuteur,
-- ni l'affectation de formateur/responsable
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.beneficiaires where id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers voit le beneficiaire d''une autre organisation'; end if;

  select count(*) into v_count from public.parents_tuteurs where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers voit le parent/tuteur d''une autre organisation'; end if;

  select count(*) into v_count from public.affectations_personnel where cible_type = 'beneficiaire' and cible_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers voit l''affectation formateur/responsable d''une autre organisation'; end if;

  raise notice 'OK cloisonnement: un tiers d''une autre organisation ne voit aucun des 3 types de contact';
end $$;
reset role;

reset role;
rollback;
