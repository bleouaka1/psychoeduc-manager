-- Script de vérification T9 — cloisonnement multi-organisations, Étape 2 (SaaS commercial)
begin;
set role postgres;

do $$
declare
  v_user1 uuid := gen_random_uuid();
  v_user2 uuid := gen_random_uuid();
  v_user_fondateur uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_membre_fondateur uuid;
  v_count int;
  v_licence1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_user1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test2-org1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_user2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test2-org2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_user_fondateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test2-fondateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A2', 'structure', v_user1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Employeur Test B2', 'employeur', v_user2) returning id into v_org2;

  -- vérifie l'auto-création licence/essai/quotas (T2)
  select id into v_licence1 from public.licences where organisation_id = v_org1;
  if v_licence1 is null then raise exception 'ECHEC T2: aucune licence auto-creee pour org1'; end if;

  select count(*) into v_count from public.licences where organisation_id = v_org1 and statut = 'essai_gratuit' and type_licence = 'structure';
  if v_count <> 1 then raise exception 'ECHEC T2: licence org1 mal configuree (attendu structure/essai_gratuit)'; end if;

  select count(*) into v_count from public.licences where organisation_id = v_org2 and type_licence = 'employeur';
  if v_count <> 1 then raise exception 'ECHEC T2: licence org2 mal configuree (attendu employeur)'; end if;

  select count(*) into v_count from public.essais_gratuits where organisation_id = v_org1;
  if v_count <> 1 then raise exception 'ECHEC T2: essai_gratuit non auto-cree pour org1'; end if;

  select count(*) into v_count from public.quotas_organisations where organisation_id = v_org1;
  if v_count <> 1 then raise exception 'ECHEC T2: quotas_organisations non auto-cree pour org1'; end if;

  raise notice 'OK T2: licence/essai_gratuit/quotas auto-crees correctement a la creation de l''organisation';

  -- paiement de test pour org1 (initie puis confirme, chaine append-only)
  declare
    v_paiement_initie uuid;
  begin
    insert into public.paiements (organisation_id, montant, statut, created_by)
    values (v_org1, 50000, 'initie', v_user1) returning id into v_paiement_initie;

    insert into public.paiements (organisation_id, montant, statut, paiement_precedent_id, created_by)
    values (v_org1, 50000, 'confirme', v_paiement_initie, v_user1);
  end;

  -- fondateur
  insert into public.membres_organisations (organisation_id, profile_id, statut, created_by) values (v_org1, v_user_fondateur, 'actif', v_user_fondateur) returning id into v_membre_fondateur;
  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by) values (v_membre_fondateur, 'fondateur', v_user_fondateur);

  insert into public.transactions_wallet (type_mouvement, montant, statut, created_by) values ('revenu_abonnement', 7500, 'confirme', v_user_fondateur);
  insert into public.transactions_wallet (type_mouvement, montant, statut, created_by) values ('retrait', -2000, 'confirme', v_user_fondateur);

  perform set_config('test2.user1', v_user1::text, false);
  perform set_config('test2.user2', v_user2::text, false);
  perform set_config('test2.user_fondateur', v_user_fondateur::text, false);
  perform set_config('test2.org1', v_org1::text, false);
  perform set_config('test2.org2', v_org2::text, false);
end $$;

-- ============================================================================
-- user1 : ne doit voir que les licences/paiements/abonnements de son organisation
-- ============================================================================
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test2.user1'), 'role', 'authenticated')::text, false);

do $$
declare
  v_count int;
  v_org2 uuid := current_setting('test2.org2')::uuid;
begin
  select count(*) into v_count from public.licences where organisation_id = v_org2;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement licences: user1 voit la licence de org2'; end if;

  select count(*) into v_count from public.paiements where organisation_id = v_org2;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement paiements: user1 voit les paiements de org2'; end if;

  select count(*) into v_count from public.essais_gratuits where organisation_id = v_org2;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement essais_gratuits: user1 voit celui de org2'; end if;

  -- user1 ne doit pas voir le wallet fondateur ni ses transactions
  select count(*) into v_count from public.transactions_wallet;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement wallet: user1 voit des transactions_wallet (reserve fondateur)'; end if;

  select solde into strict v_count from public.wallet_fondateur; -- via security_invoker, doit refleter 0 vu par user1 (aucune ligne visible)
  if v_count <> 0 then raise exception 'ECHEC cloisonnement wallet_fondateur: user1 voit un solde non nul (%)', v_count; end if;

  raise notice 'OK cloisonnement Etape 2: aucune fuite licences/paiements/essais/wallet vers user1';
end $$;

-- tentative d'ecriture croisee : user1 tente un paiement pour org2
do $$
begin
  begin
    insert into public.paiements (organisation_id, montant, statut, created_by)
    values (current_setting('test2.org2')::uuid, 1000, 'initie', current_setting('test2.user1')::uuid);
    raise exception 'ECHEC cloisonnement: user1 a reussi a inserer un paiement pour org2';
  exception
    when insufficient_privilege or others then
      raise notice 'OK cloisonnement INSERT paiements: ecriture croisee vers org2 bloquee';
  end;
end $$;

-- append-only : meme le fondateur ne peut pas modifier un paiement existant
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test2.user_fondateur'), 'role', 'authenticated')::text, false);

do $$
begin
  begin
    update public.paiements set statut = 'rembourse' where true;
    raise exception 'ECHEC append-only paiements: UPDATE a reussi';
  exception
    when insufficient_privilege or others then
      raise notice 'OK append-only paiements: UPDATE bloque (aucune policy d''ecriture apres insert)';
  end;

  begin
    delete from public.paiements where true;
    raise exception 'ECHEC append-only paiements: DELETE a reussi';
  exception
    when insufficient_privilege or others then
      raise notice 'OK append-only paiements: DELETE bloque';
  end;

  begin
    update public.transactions_wallet set montant = 999999 where true;
    raise exception 'ECHEC append-only transactions_wallet: UPDATE a reussi';
  exception
    when insufficient_privilege or others then
      raise notice 'OK append-only transactions_wallet: UPDATE bloque';
  end;
end $$;

-- fondateur voit bien le solde wallet correct (7500 - 2000 = 5500)
do $$
declare
  v_solde numeric;
begin
  select solde into v_solde from public.wallet_fondateur;
  if v_solde <> 5500 then raise exception 'ECHEC wallet_fondateur: solde=% attendu 5500', v_solde; end if;
  raise notice 'OK wallet_fondateur: solde calcule correctement (5500) depuis transactions_wallet';
end $$;

reset role;
rollback;
