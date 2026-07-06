-- Vérification — Étape 2/3 (logique de création) : la vue publique unifiée
-- n'expose jamais deux fois une formation qui a une offre marketplace liée,
-- qu'elle soit encore brouillon (visible_en_verification uniquement) ou déjà
-- publiée en interne (les deux branches de la vue doivent alors converger vers 1).
begin;
set role postgres;

do $$
declare
  v_vendeur uuid := gen_random_uuid();
  v_org uuid;
  v_formation_liee uuid;
  v_formation_non_liee uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (v_vendeur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testlogique-vendeur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Vendeur Test Logique', 'solo', v_vendeur) returning id into v_org;

  -- formation A : brouillon a la creation, obtient immediatement une offre liee (simule le TS)
  insert into public.formations (organisation_id, titre, statut, created_by) values (v_org, 'Formation Liee Test', 'brouillon', v_vendeur) returning id into v_formation_liee;
  insert into public.marketplace_offres (organisation_id, type_offre, titre, formation_id, created_by)
    values (v_org, 'formation', 'Formation Liee Test', v_formation_liee, v_vendeur);

  -- formation B : ancienne formation deja publiee AVANT cette fonctionnalite, jamais liee
  insert into public.formations (organisation_id, titre, statut, created_by) values (v_org, 'Formation Non Liee Test', 'publiee', v_vendeur) returning id into v_formation_non_liee;

  perform set_config('t.org', v_org::text, false);
  perform set_config('t.formation_liee', v_formation_liee::text, false);
  perform set_config('t.formation_non_liee', v_formation_non_liee::text, false);
end $$;

-- formation liee (encore brouillon) : visible UNE SEULE fois, via la branche marketplace_offres
do $$
declare v_count int;
begin
  select count(*) into v_count from public.vue_marketplace_publique where organisation_id = current_setting('t.org')::uuid and titre = 'Formation Liee Test';
  if v_count <> 1 then raise exception 'ECHEC: formation liee (brouillon) visible % fois, attendu 1', v_count; end if;
  raise notice 'OK: formation brouillon avec offre liee visible exactement 1 fois (via marketplace_offres)';
end $$;

-- formation non liee (deja publiee, ancienne) : toujours visible via la branche formations, aucune regression
do $$
declare v_count int;
begin
  select count(*) into v_count from public.vue_marketplace_publique where organisation_id = current_setting('t.org')::uuid and titre = 'Formation Non Liee Test';
  if v_count <> 1 then raise exception 'ECHEC NON-REGRESSION: formation publiee non liee visible % fois, attendu 1', v_count; end if;
  raise notice 'OK non-regression: une ancienne formation publiee sans offre liee reste visible normalement';
end $$;

-- si la formation liee passe ensuite a publiee en interne, toujours visible UNE SEULE fois (pas de doublon)
update public.formations set statut = 'publiee' where id = current_setting('t.formation_liee')::uuid;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.vue_marketplace_publique where organisation_id = current_setting('t.org')::uuid and titre = 'Formation Liee Test';
  if v_count <> 1 then raise exception 'ECHEC: formation liee publiee en interne visible % fois, attendu 1 (doublon detecte)', v_count; end if;
  raise notice 'OK: aucune duplication meme apres publication interne de la formation';
end $$;

reset role;
rollback;
