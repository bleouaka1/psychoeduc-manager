-- Vérification — statuts élargis (demande/refus/archive), messagerie typée,
-- signalement JAMAIS visible par le bénéficiaire concerné.
begin;
set role postgres;

do $$
declare
  v_formateur uuid := gen_random_uuid();
  v_beneficiaire_profile uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
  v_beneficiaire uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_formateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testbenef-formateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_beneficiaire_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testbenef-beneficiaire@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testbenef-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Beneficiaires', 'solo', v_formateur) returning id into v_org;

  -- le beneficiaire a un compte propre (profile_id renseigne) pour tester sa propre visibilite
  insert into public.beneficiaires (organisation_id, nom, prenoms, profile_id, statut_beneficiaire, created_by)
    values (v_org, 'Test', 'Beneficiaire', v_beneficiaire_profile, 'en_attente', v_formateur) returning id into v_beneficiaire;

  perform set_config('t.formateur', v_formateur::text, false);
  perform set_config('t.beneficiaire_profile', v_beneficiaire_profile::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org', v_org::text, false);
  perform set_config('t.beneficiaire', v_beneficiaire::text, false);
end $$;

-- nouveau statut 'en_attente' accepte par la contrainte elargie
do $$
declare v_statut text;
begin
  select statut_beneficiaire into v_statut from public.beneficiaires where id = current_setting('t.beneficiaire')::uuid;
  if v_statut <> 'en_attente' then raise exception 'ECHEC: statut en_attente non accepte (%)', v_statut; end if;
  raise notice 'OK: statut_beneficiaire elargi accepte "en_attente"';
end $$;

-- validation de la demande -> actif
update public.beneficiaires set statut_beneficiaire = 'actif', valide_par = current_setting('t.formateur')::uuid, date_validation = now()
  where id = current_setting('t.beneficiaire')::uuid;

-- statut 'refuse' + motif accepte (sur un second beneficiaire jetable)
do $$
declare v_id uuid;
begin
  insert into public.beneficiaires (organisation_id, nom, prenoms, statut_beneficiaire, motif_refus, created_by)
    values (current_setting('t.org')::uuid, 'Refuse', 'Test', 'refuse', 'Doublon avec un dossier existant', current_setting('t.formateur')::uuid)
    returning id into v_id;
  raise notice 'OK: statut "refuse" + motif_refus accepte (id=%)', v_id;
end $$;

-- messages typés : un message de suivi et un signalement, tous deux adresses au meme beneficiaire
insert into public.messages (organisation_id, expediteur_id, destinataire_beneficiaire_id, contenu, type_message, canal)
  values (current_setting('t.org')::uuid, current_setting('t.formateur')::uuid, current_setting('t.beneficiaire')::uuid, 'Message de suivi normal', 'suivi', 'interne');
insert into public.messages (organisation_id, expediteur_id, destinataire_beneficiaire_id, contenu, type_message, canal)
  values (current_setting('t.org')::uuid, current_setting('t.formateur')::uuid, current_setting('t.beneficiaire')::uuid, 'Signalement sensible - ne doit jamais etre vu par le beneficiaire', 'signalement', 'interne');

-- le beneficiaire lui-meme voit le message de suivi mais JAMAIS le signalement
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.beneficiaire_profile'), 'role', 'authenticated')::text, false);
do $$
declare v_suivi int; v_signalement int;
begin
  select count(*) into v_suivi from public.messages where destinataire_beneficiaire_id = current_setting('t.beneficiaire')::uuid and type_message = 'suivi';
  select count(*) into v_signalement from public.messages where destinataire_beneficiaire_id = current_setting('t.beneficiaire')::uuid and type_message = 'signalement';
  if v_suivi <> 1 then raise exception 'ECHEC: le beneficiaire ne voit pas son propre message de suivi (count=%)', v_suivi; end if;
  if v_signalement <> 0 then raise exception 'ECHEC SECURITE CRITIQUE: le beneficiaire voit un signalement qui le concerne (count=%)', v_signalement; end if;
  raise notice 'OK SECURITE: le beneficiaire voit le suivi (1) mais jamais le signalement (0) le concernant';
end $$;
reset role;

-- un tiers (ni formateur ni beneficiaire concerne) ne voit ni l'un ni l'autre
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.messages where destinataire_beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers voit des messages lies a un beneficiaire hors de son organisation (count=%)', v_count; end if;
  raise notice 'OK cloisonnement: un tiers ne voit aucun message lie a ce beneficiaire';
end $$;
reset role;

reset role;
rollback;
