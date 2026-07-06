-- Script de vérification T3 — validation conditionnelle, cloisonnement, Étape 17
begin;
set role postgres;

do $$
declare
  v_fondateur uuid := gen_random_uuid();
  v_staff1 uuid := gen_random_uuid();
  v_org1 uuid;
  v_membre_f uuid;
  v_evt_fondateur uuid;
  v_evt_org uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_fondateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test17-fondateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test17-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A17', 'structure', v_staff1) returning id into v_org1;
  insert into public.membres_organisations (organisation_id, profile_id, statut, created_by) values (v_org1, v_fondateur, 'actif', v_fondateur) returning id into v_membre_f;
  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by) values (v_membre_f, 'fondateur', v_fondateur);

  -- evenement cree par le fondateur -> publie directement
  insert into public.evenements (createur_type, createur_id, titre, type_evenement, created_by) values ('fondateur', v_fondateur, 'Evenement Fondateur', 'gratuit', v_fondateur) returning id into v_evt_fondateur;

  -- evenement cree par une organisation -> en_attente_validation
  insert into public.evenements (createur_type, createur_id, titre, type_evenement, organisation_id, created_by) values ('organisation', v_staff1, 'Evenement Org', 'payant', v_org1, v_staff1) returning id into v_evt_org;

  perform set_config('test17.evt_fondateur', v_evt_fondateur::text, false);
  perform set_config('test17.evt_org', v_evt_org::text, false);
end $$;

do $$
declare v_statut1 text; v_statut2 text;
begin
  select statut into v_statut1 from public.evenements where id = current_setting('test17.evt_fondateur')::uuid;
  select statut into v_statut2 from public.evenements where id = current_setting('test17.evt_org')::uuid;
  if v_statut1 <> 'publie' then raise exception 'ECHEC: evenement fondateur devrait etre publie directement, statut=%', v_statut1; end if;
  if v_statut2 <> 'en_attente_validation' then raise exception 'ECHEC: evenement organisation devrait etre en_attente_validation, statut=%', v_statut2; end if;
  raise notice 'OK Etape 17: evenement fondateur publie directement, evenement organisation en attente de validation';
end $$;

reset role;
rollback;
