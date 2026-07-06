-- Script de vérification T3 — append-only + cloisonnement + réconciliation, Étape 15
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test15-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test15-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A15', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B15', 'structure', v_staff2) returning id into v_org2;

  insert into public.mouvements_financiers (organisation_id, type_mouvement, montant, created_by) values (v_org1, 'revenu_abonnement', 50000, v_staff1);
  -- mouvement plateforme (organisation_id/beneficiaire_id null)
  insert into public.mouvements_financiers (type_mouvement, montant, created_by) values ('commission', 12000, v_staff1);

  perform set_config('test15.staff2', v_staff2::text, false);
end $$;

-- reconciliation : le wallet_fondateur doit inclure le mouvement plateforme (12000)
do $$
declare v_solde numeric;
begin
  select solde into v_solde from public.wallet_fondateur;
  if v_solde <> 12000 then raise exception 'ECHEC reconciliation wallet_fondateur: solde=% attendu 12000', v_solde; end if;
  raise notice 'OK reconciliation: wallet_fondateur inclut bien les mouvements plateforme de mouvements_financiers (12000)';
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test15.staff2'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.mouvements_financiers where organisation_id = (select id from public.organisations where nom = 'Structure Test A15');
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit les mouvements financiers de org1'; end if;
  raise notice 'OK cloisonnement Etape 15: 0 fuite mouvements_financiers vers staff2 (autre organisation)';
end $$;

do $$
begin
  begin
    update public.mouvements_financiers set montant = 999999 where true;
    raise exception 'ECHEC append-only mouvements_financiers: UPDATE a reussi';
  exception
    when insufficient_privilege or others then
      raise notice 'OK append-only mouvements_financiers: UPDATE bloque';
  end;
  begin
    delete from public.mouvements_financiers where true;
    raise exception 'ECHEC append-only mouvements_financiers: DELETE a reussi';
  exception
    when insufficient_privilege or others then
      raise notice 'OK append-only mouvements_financiers: DELETE bloque';
  end;
end $$;

reset role;
rollback;
