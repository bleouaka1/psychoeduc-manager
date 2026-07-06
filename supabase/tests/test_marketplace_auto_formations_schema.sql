-- Vérification — Étape 1/3 (schéma) : nouveau statut visible_en_verification,
-- visibilité publique immédiate, masquage par signalement, non-régression sur le
-- comportement existant (produit/service manuel toujours en_attente_validation).
begin;
set role postgres;

do $$
declare
  v_fondateur uuid := gen_random_uuid();
  v_vendeur uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
  v_formation uuid;
  v_offre_formation uuid;
  v_offre_produit uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_fondateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testschema-fondateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_vendeur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testschema-vendeur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testschema-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Vendeur Test Schema', 'solo', v_vendeur) returning id into v_org;

  -- le fondateur jetable ci-dessus n'a pas le role 'fondateur' : on utilise la fonction
  -- is_fondateur() telle quelle (renvoie false), le test de validation ne teste donc que
  -- le rejet pour un non-fondateur (deja couvert par test_marketplace_generaliste.sql) ;
  -- ici on verifie uniquement le NOUVEAU comportement du statut.
  insert into public.formations (organisation_id, titre, statut, created_by)
    values (v_org, 'Formation Test Schema', 'publiee', v_vendeur) returning id into v_formation;

  insert into public.marketplace_offres (organisation_id, type_offre, titre, formation_id, created_by)
    values (v_org, 'formation', 'Formation Test Schema', v_formation, v_vendeur) returning id into v_offre_formation;

  insert into public.marketplace_offres (organisation_id, type_offre, titre, created_by)
    values (v_org, 'produit', 'Produit Test Schema', v_vendeur) returning id into v_offre_produit;

  perform set_config('t.vendeur', v_vendeur::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org', v_org::text, false);
  perform set_config('t.offre_formation', v_offre_formation::text, false);
  perform set_config('t.offre_produit', v_offre_produit::text, false);
end $$;

-- une offre formation auto-liée entre directement en visible_en_verification
do $$
declare v_statut text;
begin
  select statut into v_statut from public.marketplace_offres where id = current_setting('t.offre_formation')::uuid;
  if v_statut <> 'visible_en_verification' then raise exception 'ECHEC: offre formation liee entree en % au lieu de visible_en_verification', v_statut; end if;
  raise notice 'OK: offre formation avec formation_id entre bien en visible_en_verification';
end $$;

-- non-regression : une offre produit/service manuelle (sans formation_id) reste en_attente_validation
do $$
declare v_statut text;
begin
  select statut into v_statut from public.marketplace_offres where id = current_setting('t.offre_produit')::uuid;
  if v_statut <> 'en_attente_validation' then raise exception 'ECHEC NON-REGRESSION: offre produit manuelle entree en % au lieu de en_attente_validation', v_statut; end if;
  raise notice 'OK non-regression: une offre produit/service manuelle entre toujours en en_attente_validation';
end $$;

-- visibilite publique immediate : un tiers authentifie (sans lien avec le vendeur) voit l'offre formation
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count_formation int; v_count_produit int;
begin
  select count(*) into v_count_formation from public.marketplace_offres where id = current_setting('t.offre_formation')::uuid;
  select count(*) into v_count_produit from public.marketplace_offres where id = current_setting('t.offre_produit')::uuid;
  if v_count_formation <> 1 then raise exception 'ECHEC: un tiers ne voit pas une offre visible_en_verification (devrait etre publique)'; end if;
  if v_count_produit <> 0 then raise exception 'ECHEC: un tiers voit une offre en_attente_validation (ne devrait PAS etre publique)'; end if;
  raise notice 'OK: visible_en_verification est publique, en_attente_validation reste privee (RLS correcte)';
end $$;
reset role;

-- masquage automatique par signalement s'applique aussi a visible_en_verification
set role postgres;
insert into public.marketplace_signalements (offre_id, signale_par, motif) values (current_setting('t.offre_formation')::uuid, current_setting('t.tiers')::uuid, 'motif 1');
insert into public.marketplace_signalements (offre_id, signale_par, motif) values (current_setting('t.offre_formation')::uuid, current_setting('t.vendeur')::uuid, 'motif 2');
insert into public.marketplace_signalements (offre_id, signale_par, motif) values (current_setting('t.offre_formation')::uuid, current_setting('t.tiers')::uuid, 'motif 3');

do $$
declare v_statut text;
begin
  select statut into v_statut from public.marketplace_offres where id = current_setting('t.offre_formation')::uuid;
  if v_statut <> 'masquee' then raise exception 'ECHEC: offre visible_en_verification non masquee au seuil de signalements (statut=%)', v_statut; end if;
  raise notice 'OK: masquage automatique par signalement fonctionne aussi pour visible_en_verification';
end $$;

reset role;
rollback;
