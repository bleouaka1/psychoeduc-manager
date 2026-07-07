-- Vérification — Fiches d'entretien (CLAUDE-CODE-Entretiens-Messagerie.md §2)
-- Cloisonnement RLS inter-organisations, contrainte check sur type_entretien/statut,
-- et confirmation que le rôle 'beneficiaire' n'a jamais accès à ses propres entretiens
-- via la matrice de permissions (donnée clinique/interne, pas un contenu qui lui est adressé).
begin;
set role postgres;

do $$
declare
  v_praticien uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_beneficiaire_user uuid := gen_random_uuid();
  v_org uuid;
  v_org_tiers uuid;
  v_beneficiaire uuid;
  v_dimension uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_praticien, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testent-praticien@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testent-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_beneficiaire_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testent-beneficiaire@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Entretiens', 'solo', v_praticien) returning id into v_org;
  insert into public.organisations (nom, type_organisation, created_by) values ('Org Tiers Entretiens', 'solo', v_tiers) returning id into v_org_tiers;

  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org, v_beneficiaire_user, 'Diallo', 'Aminata', 'actif', v_praticien) returning id into v_beneficiaire;

  select id into v_dimension from public.dimensions_iga limit 1;

  perform set_config('t.praticien', v_praticien::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.beneficiaire_user', v_beneficiaire_user::text, false);
  perform set_config('t.org', v_org::text, false);
  perform set_config('t.beneficiaire', v_beneficiaire::text, false);
  perform set_config('t.dimension', v_dimension::text, false);
end $$;

-- Le praticien (administrateur de son organisation) peut créer un entretien général
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.praticien'), 'role', 'authenticated')::text, false);
do $$
declare
  v_entretien uuid;
begin
  insert into public.entretiens (beneficiaire_id, organisation_id, type_entretien, donnees, mene_par, created_by)
    values (
      current_setting('t.beneficiaire')::uuid,
      current_setting('t.org')::uuid,
      'general',
      jsonb_build_object('dimensionsIds', jsonb_build_array(current_setting('t.dimension'))),
      current_setting('t.praticien')::uuid,
      current_setting('t.praticien')::uuid
    )
    returning id into v_entretien;

  perform set_config('t.entretien', v_entretien::text, false);
  raise notice 'OK: le praticien peut creer un entretien general (statut par defaut brouillon)';
end $$;
reset role;

-- Statut par defaut = brouillon, dimensionsIds bien persiste dans le jsonb
do $$
declare v_statut text; v_dims jsonb;
begin
  select statut, donnees -> 'dimensionsIds' into v_statut, v_dims from public.entretiens where id = current_setting('t.entretien')::uuid;
  if v_statut <> 'brouillon' then raise exception 'ECHEC: statut par defaut incorrect (%)', v_statut; end if;
  if jsonb_array_length(v_dims) <> 1 then raise exception 'ECHEC: dimensionsIds non persiste correctement'; end if;
  raise notice 'OK: statut par defaut brouillon + donnees jsonb persistees';
end $$;

-- La contrainte check rejette un type_entretien hors enum
do $$
begin
  begin
    insert into public.entretiens (beneficiaire_id, organisation_id, type_entretien, created_by)
      values (current_setting('t.beneficiaire')::uuid, current_setting('t.org')::uuid, 'autre_chose', current_setting('t.praticien')::uuid);
    raise exception 'ECHEC: la contrainte check aurait du rejeter un type_entretien invalide';
  exception when check_violation then
    raise notice 'OK: contrainte check rejette un type_entretien invalide';
  end;
end $$;

-- Validation : passage a 'valide' + valide_par/valide_le
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.praticien'), 'role', 'authenticated')::text, false);
do $$
begin
  update public.entretiens
    set statut = 'valide', valide_par = current_setting('t.praticien')::uuid, valide_le = now()
    where id = current_setting('t.entretien')::uuid;
  raise notice 'OK: le praticien peut valider son entretien';
end $$;
reset role;

do $$
declare v_statut text; v_valide_par uuid;
begin
  select statut, valide_par into v_statut, v_valide_par from public.entretiens where id = current_setting('t.entretien')::uuid;
  if v_statut <> 'valide' or v_valide_par <> current_setting('t.praticien')::uuid then
    raise exception 'ECHEC: validation non appliquee correctement (statut=%, valide_par=%)', v_statut, v_valide_par;
  end if;
  raise notice 'OK: validation persistee (statut + valide_par)';
end $$;

-- Cloisonnement : un tiers d'une autre organisation ne voit ni ne peut modifier cet entretien
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.entretiens where id = current_setting('t.entretien')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers d''une autre organisation voit l''entretien'; end if;

  update public.entretiens set statut = 'brouillon' where id = current_setting('t.entretien')::uuid;
  select count(*) into v_count from public.entretiens where id = current_setting('t.entretien')::uuid and statut = 'brouillon';
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers a pu repasser l''entretien en brouillon'; end if;

  raise notice 'OK cloisonnement: un tiers d''une autre organisation ne voit ni ne peut modifier l''entretien';
end $$;
reset role;

-- Le beneficiaire concerne lui-meme (acces "sa propre fiche") ne voit PAS ses entretiens :
-- peut_lire=false pour le role 'beneficiaire' sur le module 'entretiens', deliberement
-- (donnee clinique interne, cf. migration). Aucune clause "profile_id = auth.uid()"
-- n'existe sur entretiens_select, contrairement a beneficiaires_select.
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.beneficiaire_user'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.entretiens where id = current_setting('t.entretien')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: le beneficiaire concerne voit son propre entretien (ne devrait jamais etre le cas)'; end if;
  raise notice 'OK: le beneficiaire concerne n''a pas acces a ses entretiens (donnee clinique interne)';
end $$;
reset role;

reset role;
rollback;
