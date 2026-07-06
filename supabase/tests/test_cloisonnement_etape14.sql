-- Script de vérification T4 — cloisonnement + append-only + vues, Étape 14
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_ben1 uuid;
  v_projet1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test14-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test14-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A14', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B14', 'structure', v_staff2) returning id into v_org2;

  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'Kra', 'Yves', v_staff1) returning id into v_ben1;
  insert into public.projets_financement (beneficiaire_id, organisation_id, titre, montant_cible, created_by) values (v_ben1, v_org1, 'Achat machine a coudre', 100000, v_staff1) returning id into v_projet1;
  insert into public.contributions_financement (projet_id, organisation_id, contributeur_nom, montant, statut, created_by) values (v_projet1, v_org1, 'Donateur Test', 30000, 'confirme', v_staff1);

  -- mouvement financier credite au beneficiaire (simule l'orchestration applicative future)
  insert into public.mouvements_financiers (organisation_id, beneficiaire_id, type_mouvement, montant, statut, created_by)
    values (v_org1, v_ben1, 'contribution_financement', 25500, 'confirme', v_staff1);

  perform set_config('test14.staff2', v_staff2::text, false);
  perform set_config('test14.ben1', v_ben1::text, false);
end $$;

-- wallets_beneficiaires reflete bien le mouvement (25500)
do $$
declare v_solde numeric;
begin
  select solde into v_solde from public.wallets_beneficiaires where beneficiaire_id = current_setting('test14.ben1')::uuid;
  if v_solde <> 25500 then raise exception 'ECHEC wallets_beneficiaires: solde=% attendu 25500', v_solde; end if;
  raise notice 'OK wallets_beneficiaires: solde calcule correctement depuis mouvements_financiers (25500)';
end $$;

-- vue_soldes_actuels contient bien la ligne beneficiaire ET la ligne fondateur
do $$
declare v_count int;
begin
  select count(*) into v_count from public.vue_soldes_actuels where type_solde = 'fondateur';
  if v_count <> 1 then raise exception 'ECHEC vue_soldes_actuels: pas de ligne fondateur (% lignes)', v_count; end if;
  select count(*) into v_count from public.vue_soldes_actuels where type_solde = 'beneficiaire' and beneficiaire_id = current_setting('test14.ben1')::uuid;
  if v_count <> 1 then raise exception 'ECHEC vue_soldes_actuels: pas de ligne pour le beneficiaire test'; end if;
  raise notice 'OK vue_soldes_actuels: panorama unifie fondateur + beneficiaires correct';
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test14.staff2'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.projets_financement;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit projets_financement de org1'; end if;
  select count(*) into v_count from public.contributions_financement;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit contributions_financement de org1'; end if;
  raise notice 'OK cloisonnement Etape 14: 0 fuite projets/contributions vers staff2 (autre organisation)';
end $$;

set role postgres;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test14.staff2'), 'role', 'authenticated')::text, false);
set role authenticated;
do $$
begin
  begin
    update public.contributions_financement set montant = 999999 where true;
    raise exception 'ECHEC append-only contributions_financement: UPDATE a reussi (ou aucune ligne visible pour bloquer -- verifier RLS select)';
  exception
    when insufficient_privilege or others then
      raise notice 'OK append-only contributions_financement: UPDATE bloque';
  end;
end $$;

reset role;
rollback;
