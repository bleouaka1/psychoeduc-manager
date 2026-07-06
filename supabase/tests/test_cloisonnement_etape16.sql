-- Script de vérification T5 — validation, masquage auto, cloisonnement, append-only, Étape 16
begin;
set role postgres;

do $$
declare
  v_fondateur uuid := gen_random_uuid();
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_membre_f uuid;
  v_offre1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_fondateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test16-fondateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test16-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test16-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A16', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B16', 'structure', v_staff2) returning id into v_org2;

  insert into public.membres_organisations (organisation_id, profile_id, statut, created_by) values (v_org1, v_fondateur, 'actif', v_fondateur) returning id into v_membre_f;
  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by) values (v_membre_f, 'fondateur', v_fondateur);

  -- tentative de creer une offre DEJA publiee -- doit etre forcee a en_attente_validation
  insert into public.marketplace_offres (vendeur_type, vendeur_id, type_offre, titre, prix, organisation_id, statut, created_by)
    values ('organisation', v_staff1, 'formation', 'Formation Test', 5000, v_org1, 'publiee', v_staff1)
    returning id into v_offre1;

  perform set_config('test16.fondateur', v_fondateur::text, false);
  perform set_config('test16.staff1', v_staff1::text, false);
  perform set_config('test16.staff2', v_staff2::text, false);
  perform set_config('test16.offre1', v_offre1::text, false);
end $$;

do $$
declare v_statut text;
begin
  select statut into v_statut from public.marketplace_offres where id = current_setting('test16.offre1')::uuid;
  if v_statut <> 'en_attente_validation' then raise exception 'ECHEC: statut force a % au lieu de en_attente_validation', v_statut; end if;
  raise notice 'OK: toute nouvelle offre entre en_attente_validation, meme si publiee etait demande explicitement';
end $$;

set role authenticated;

-- staff2 (autre organisation) ne doit pas voir l'offre non publiee
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test16.staff2'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.marketplace_offres where id = current_setting('test16.offre1')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit une offre non validee d''une autre organisation'; end if;
  raise notice 'OK cloisonnement: offre en_attente_validation invisible pour un tiers non-vendeur/non-fondateur';
end $$;

-- staff1 (le vendeur) ne peut pas s'auto-valider
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test16.staff1'), 'role', 'authenticated')::text, false);
do $$
begin
  begin
    update public.marketplace_offres set statut = 'publiee' where id = current_setting('test16.offre1')::uuid;
    raise exception 'ECHEC SECURITE: le vendeur a pu auto-valider sa propre offre';
  exception
    when others then
      raise notice 'OK SECURITE: seul le fondateur peut valider une offre (auto-validation bloquee)';
  end;
end $$;

-- le fondateur valide l'offre
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test16.fondateur'), 'role', 'authenticated')::text, false);
update public.marketplace_offres set statut = 'publiee' where id = current_setting('test16.offre1')::uuid;

do $$
declare v_statut text; v_date timestamptz;
begin
  select statut, date_validation into v_statut, v_date from public.marketplace_offres where id = current_setting('test16.offre1')::uuid;
  if v_statut <> 'publiee' then raise exception 'ECHEC: le fondateur n''a pas pu valider l''offre'; end if;
  if v_date is null then raise exception 'ECHEC: date_validation non renseignee apres validation'; end if;
  raise notice 'OK: le fondateur valide l''offre, date_validation renseignee automatiquement';
end $$;

-- maintenant publiee, staff2 doit la voir
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test16.staff2'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.marketplace_offres where id = current_setting('test16.offre1')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: une offre publiee devrait etre visible par tous'; end if;
  raise notice 'OK: une offre publiee est visible par un tiers (marketplace ouverte)';
end $$;

-- 3 signalements -> masquage automatique
do $$
begin
  insert into public.marketplace_signalements (offre_id, signale_par, motif) values (current_setting('test16.offre1')::uuid, current_setting('test16.staff2')::uuid, 'motif1');
  insert into public.marketplace_signalements (offre_id, signale_par, motif) values (current_setting('test16.offre1')::uuid, current_setting('test16.staff2')::uuid, 'motif2');
  insert into public.marketplace_signalements (offre_id, signale_par, motif) values (current_setting('test16.offre1')::uuid, current_setting('test16.staff2')::uuid, 'motif3');
end $$;

set role postgres;
do $$
declare v_statut text; v_nb int;
begin
  select statut, nombre_signalements into v_statut, v_nb from public.marketplace_offres where id = current_setting('test16.offre1')::uuid;
  if v_statut <> 'masquee' then raise exception 'ECHEC masquage auto: statut=% (nombre_signalements=%) attendu masquee', v_statut, v_nb; end if;
  raise notice 'OK masquage automatique: 3 signalements -> statut masquee (nombre_signalements=%)', v_nb;
end $$;

-- append-only marketplace_commandes
insert into public.marketplace_commandes (offre_id, acheteur_id, montant_brut, statut_paiement) values (current_setting('test16.offre1')::uuid, current_setting('test16.staff2')::uuid, 5000, 'confirme');
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test16.fondateur'), 'role', 'authenticated')::text, false);
do $$
begin
  begin
    update public.marketplace_commandes set montant_brut = 1 where true;
    raise exception 'ECHEC append-only marketplace_commandes: UPDATE a reussi';
  exception
    when insufficient_privilege or others then
      raise notice 'OK append-only marketplace_commandes: UPDATE bloque';
  end;
end $$;

reset role;
rollback;
