-- Vérification — Projet de vie (PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md, Phase 2)
begin;
set role postgres;

do $$
declare
  v_praticien uuid := gen_random_uuid();
  v_beneficiaire_user uuid := gen_random_uuid();
  v_autre_beneficiaire_user uuid := gen_random_uuid();
  v_org uuid;
  v_beneficiaire uuid;
  v_autre_beneficiaire uuid;
  v_objectif uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_praticien, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testpdv-praticien@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_beneficiaire_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testpdv-beneficiaire@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_autre_beneficiaire_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testpdv-autre@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Projet De Vie', 'solo', v_praticien) returning id into v_org;

  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, date_naissance, statut_beneficiaire, created_by)
    values (v_org, v_beneficiaire_user, 'Diallo', 'Fatou', current_date - interval '18 years', 'actif', v_praticien) returning id into v_beneficiaire;
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, date_naissance, statut_beneficiaire, created_by)
    values (v_org, v_autre_beneficiaire_user, 'Traore', 'Issa', current_date - interval '19 years', 'actif', v_praticien) returning id into v_autre_beneficiaire;

  perform set_config('t.praticien', v_praticien::text, false);
  perform set_config('t.beneficiaire_user', v_beneficiaire_user::text, false);
  perform set_config('t.autre_beneficiaire_user', v_autre_beneficiaire_user::text, false);
  perform set_config('t.org', v_org::text, false);
  perform set_config('t.beneficiaire', v_beneficiaire::text, false);
  perform set_config('t.autre_beneficiaire', v_autre_beneficiaire::text, false);
end $$;

-- le bénéficiaire crée son propre projet de vie (self-service, RLS insert étendue)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.beneficiaire_user'), 'role', 'authenticated')::text, false);
do $$
begin
  insert into public.projets_vie (beneficiaire_id, organisation_id, titre) values (current_setting('t.beneficiaire')::uuid, current_setting('t.org')::uuid, 'Trouver une alternance');
  insert into public.projets_vie (beneficiaire_id, organisation_id, titre) values (current_setting('t.beneficiaire')::uuid, current_setting('t.org')::uuid, 'Améliorer mon logement');
end $$;
reset role;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.projets_vie where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 2 then raise exception 'ECHEC: le beneficiaire devrait avoir 2 projets actifs en parallele (trouve %)', v_count; end if;
  raise notice 'OK: un beneficiaire peut creer plusieurs projets de vie en autonomie (RLS insert)';
end $$;

-- un bénéficiaire ne peut pas créer un projet pour un AUTRE bénéficiaire
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.beneficiaire_user'), 'role', 'authenticated')::text, false);
do $$
declare v_erreur boolean := false;
begin
  begin
    insert into public.projets_vie (beneficiaire_id, organisation_id, titre) values (current_setting('t.autre_beneficiaire')::uuid, current_setting('t.org')::uuid, 'Intrusion');
  exception when insufficient_privilege or others then
    v_erreur := true;
  end;
  if not v_erreur then raise exception 'ECHEC: un beneficiaire a pu creer un projet pour un autre beneficiaire'; end if;
  raise notice 'OK: un beneficiaire ne peut pas creer de projet pour un autre beneficiaire';
end $$;
reset role;

-- cloisonnement en lecture : un bénéficiaire ne voit jamais les projets d'un autre
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.autre_beneficiaire_user'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.projets_vie where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: un beneficiaire voit les projets d''un autre beneficiaire'; end if;
  raise notice 'OK: cloisonnement respecte entre deux beneficiaires distincts';
end $$;
reset role;

-- le bénéficiaire peut modifier (ex. abandonner) son propre projet
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.beneficiaire_user'), 'role', 'authenticated')::text, false);
do $$
declare v_statut text;
begin
  update public.projets_vie set statut = 'abandonne' where beneficiaire_id = current_setting('t.beneficiaire')::uuid and titre = 'Améliorer mon logement';
  select statut into v_statut from public.projets_vie where beneficiaire_id = current_setting('t.beneficiaire')::uuid and titre = 'Améliorer mon logement';
  if v_statut is distinct from 'abandonne' then raise exception 'ECHEC: le beneficiaire n''a pas pu modifier son propre projet'; end if;
  raise notice 'OK: le beneficiaire peut modifier (abandonner) son propre projet';
end $$;
reset role;

-- le bénéficiaire ne peut pas SUPPRIMER un projet (delete reste praticien/fondateur uniquement)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.beneficiaire_user'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  delete from public.projets_vie where beneficiaire_id = current_setting('t.beneficiaire')::uuid and titre = 'Trouver une alternance';
  select count(*) into v_count from public.projets_vie where beneficiaire_id = current_setting('t.beneficiaire')::uuid and titre = 'Trouver une alternance';
  if v_count <> 1 then raise exception 'ECHEC: le beneficiaire a pu supprimer un projet (devrait etre bloque par RLS)'; end if;
  raise notice 'OK: le beneficiaire ne peut pas supprimer un projet (delete reserve au praticien/fondateur)';
end $$;
reset role;

-- objectifs_beneficiaire.projet_vie_id : rattachement praticien (colonne additive)
do $$
declare v_projet uuid;
begin
  select id into v_projet from public.projets_vie where beneficiaire_id = current_setting('t.beneficiaire')::uuid and titre = 'Trouver une alternance';
  insert into public.objectifs_beneficiaire (beneficiaire_id, organisation_id, titre, statut, projet_vie_id, created_by)
    values (current_setting('t.beneficiaire')::uuid, current_setting('t.org')::uuid, 'Postuler chez 3 entreprises', 'atteint', v_projet, current_setting('t.praticien')::uuid);
end $$;

-- le bénéficiaire voit bien l'objectif rattaché à son projet (déjà couvert par
-- objectifs_beneficiaire_select existante, vérifié ici pour non-régression)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.beneficiaire_user'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.objectifs_beneficiaire where beneficiaire_id = current_setting('t.beneficiaire')::uuid and statut = 'atteint';
  if v_count <> 1 then raise exception 'ECHEC: le beneficiaire ne voit pas son objectif atteint rattache au projet'; end if;
  raise notice 'OK: le beneficiaire voit son objectif atteint rattache a son projet de vie';
end $$;
reset role;

reset role;
rollback;
