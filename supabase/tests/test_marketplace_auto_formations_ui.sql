-- Vérification — Étape 3/3 (UI) : visibilité publique du programme (cours), et les
-- deux fonctions SECURITY DEFINER utilisées par le profil public formateur/contact
-- (organisation_est_fondateur, premier_membre_actif) sont bien accessibles à un
-- visiteur externe qui n'est PAS membre de l'organisation concernée.
begin;
set role postgres;

do $$
declare
  v_vendeur uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
  v_formation_publiee uuid;
  v_formation_brouillon uuid;
  v_cours_publie uuid;
  v_cours_brouillon uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_vendeur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testui-vendeur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testui-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Vendeur Test UI', 'solo', v_vendeur) returning id into v_org;

  insert into public.formations (organisation_id, titre, statut, created_by) values (v_org, 'Formation Publiee Test UI', 'publiee', v_vendeur) returning id into v_formation_publiee;
  insert into public.formations (organisation_id, titre, statut, created_by) values (v_org, 'Formation Brouillon Test UI', 'brouillon', v_vendeur) returning id into v_formation_brouillon;

  insert into public.cours (formation_id, organisation_id, titre, ordre, created_by) values (v_formation_publiee, v_org, 'Module public', 1, v_vendeur) returning id into v_cours_publie;
  insert into public.cours (formation_id, organisation_id, titre, ordre, created_by) values (v_formation_brouillon, v_org, 'Module brouillon', 1, v_vendeur) returning id into v_cours_brouillon;

  perform set_config('t.vendeur', v_vendeur::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org', v_org::text, false);
end $$;

-- un tiers voit le cours d'une formation publiee, jamais celui d'une formation brouillon
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count_publie int; v_count_brouillon int;
begin
  select count(*) into v_count_publie from public.cours where titre = 'Module public';
  select count(*) into v_count_brouillon from public.cours where titre = 'Module brouillon';
  if v_count_publie <> 1 then raise exception 'ECHEC: un tiers ne voit pas le programme d''une formation publiee (count=%)', v_count_publie; end if;
  if v_count_brouillon <> 0 then raise exception 'ECHEC: un tiers voit le programme d''une formation encore brouillon (count=%)', v_count_brouillon; end if;
  raise notice 'OK: cours_select_publique expose le programme des formations publiees uniquement';
end $$;

-- organisation_est_fondateur et premier_membre_actif sont appelables par un tiers externe
do $$
declare v_est_fondateur boolean; v_membre uuid;
begin
  select public.organisation_est_fondateur(current_setting('t.org')::uuid) into v_est_fondateur;
  if v_est_fondateur is not false then raise exception 'ECHEC: organisation_est_fondateur devrait renvoyer false pour un compte Solo ordinaire'; end if;

  select public.premier_membre_actif(current_setting('t.org')::uuid) into v_membre;
  if v_membre <> current_setting('t.vendeur')::uuid then raise exception 'ECHEC: premier_membre_actif ne renvoie pas le bon profil (attendu le vendeur)'; end if;

  raise notice 'OK: organisation_est_fondateur et premier_membre_actif accessibles et corrects pour un visiteur externe';
end $$;
reset role;

reset role;
rollback;
