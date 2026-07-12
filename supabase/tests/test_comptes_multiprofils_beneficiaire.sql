-- Vérification — Comptes multiprofils / accès bénéficiaire (PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md, Phase 1, T1)
begin;
set role postgres;

do $$
declare
  v_praticien uuid := gen_random_uuid();
  v_beneficiaire_user uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org uuid;
  v_beneficiaire uuid;
  v_beneficiaire2 uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_expire text := encode(extensions.gen_random_bytes(32), 'hex');
  v_ref_id uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_praticien, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testcmp-praticien@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_beneficiaire_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testcmp-beneficiaire@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testcmp-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Multiprofils', 'solo', v_praticien) returning id into v_org;

  insert into public.beneficiaires (organisation_id, nom, prenoms, date_naissance, statut_beneficiaire, email, created_by)
    values (v_org, 'Kone', 'Awa', current_date - interval '16 years', 'actif', 'testcmp-beneficiaire@example.test', v_praticien) returning id into v_beneficiaire;
  insert into public.beneficiaires (organisation_id, nom, prenoms, date_naissance, statut_beneficiaire, email, created_by)
    values (v_org, 'Kone', 'Autre', current_date - interval '20 years', 'actif', 'autre@example.test', v_praticien) returning id into v_beneficiaire2;

  -- deux projets de vie actifs simultanés sur le même bénéficiaire (T1 : 1:N, plus 1:1)
  insert into public.projets_vie (beneficiaire_id, organisation_id, titre, created_by) values (v_beneficiaire, v_org, 'Trouver une alternance', v_praticien);
  insert into public.projets_vie (beneficiaire_id, organisation_id, titre, created_by) values (v_beneficiaire, v_org, 'Améliorer mon logement', v_praticien);

  insert into public.invitations_utilisateurs (organisation_id, email, role_propose, beneficiaire_id, token, invite_par)
    values (v_org, 'testcmp-beneficiaire@example.test', 'beneficiaire', v_beneficiaire, v_token, v_praticien);
  insert into public.invitations_utilisateurs (organisation_id, email, role_propose, beneficiaire_id, token, expire_le, invite_par)
    values (v_org, 'autre@example.test', 'beneficiaire', v_beneficiaire2, v_token_expire, now() - interval '1 day', v_praticien);

  select id into v_ref_id from public.referentiels_iga where code = 'iga_a' limit 1;
  perform set_config('t.praticien', v_praticien::text, false);
  perform set_config('t.beneficiaire_user', v_beneficiaire_user::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org', v_org::text, false);
  perform set_config('t.beneficiaire', v_beneficiaire::text, false);
  perform set_config('t.beneficiaire2', v_beneficiaire2::text, false);
  perform set_config('t.token', v_token, false);
  perform set_config('t.token_expire', v_token_expire, false);
end $$;

-- deux projets de vie actifs simultanés : aucune violation de contrainte (T1)
do $$
declare v_count int;
begin
  select count(*) into v_count from public.projets_vie where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 2 then raise exception 'ECHEC: deux projets de vie actifs auraient du coexister (trouve %)', v_count; end if;
  raise notice 'OK: projets_vie accepte plusieurs projets actifs pour le meme beneficiaire';
end $$;

-- consulter_invitation_beneficiaire, appelable en tant qu'anonyme (RPC public)
set role anon;
do $$
declare v_email text; v_prenom text; v_valide boolean;
begin
  select email, prenom, valide into v_email, v_prenom, v_valide from public.consulter_invitation_beneficiaire(current_setting('t.token'));
  if v_email is distinct from 'testcmp-beneficiaire@example.test' or v_prenom is distinct from 'Awa' or v_valide is distinct from true then
    raise exception 'ECHEC: consulter_invitation_beneficiaire ne retourne pas les bonnes donnees (email=%, prenom=%, valide=%)', v_email, v_prenom, v_valide;
  end if;
  raise notice 'OK: consulter_invitation_beneficiaire retourne email/prenom/valide corrects pour un anonyme';
end $$;

-- token expire -> valide=false, jamais une exception ni une fuite d'email
do $$
declare v_valide boolean;
begin
  select valide into v_valide from public.consulter_invitation_beneficiaire(current_setting('t.token_expire'));
  if v_valide is distinct from false then raise exception 'ECHEC: un token expire devrait retourner valide=false'; end if;
  raise notice 'OK: un token expire retourne valide=false';
end $$;

-- token inexistant -> aucune ligne (jamais une erreur)
do $$
declare v_count int;
begin
  select count(*) into v_count from public.consulter_invitation_beneficiaire('token-inexistant');
  if v_count <> 0 then raise exception 'ECHEC: un token inexistant ne devrait retourner aucune ligne'; end if;
  raise notice 'OK: un token inexistant ne retourne aucune ligne';
end $$;
reset role;

-- finaliser_acces_beneficiaire : le profil bénéficiaire lie sa propre fiche via le token
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.beneficiaire_user'), 'role', 'authenticated')::text, false);
do $$
declare v_ok boolean; v_profile_id uuid; v_statut text;
begin
  select public.finaliser_acces_beneficiaire(current_setting('t.token')) into v_ok;
  if v_ok is distinct from true then raise exception 'ECHEC: finaliser_acces_beneficiaire aurait du reussir'; end if;
end $$;
reset role;

do $$
declare v_profile_id uuid; v_statut text;
begin
  select profile_id into v_profile_id from public.beneficiaires where id = current_setting('t.beneficiaire')::uuid;
  select statut into v_statut from public.invitations_utilisateurs where token = current_setting('t.token');
  if v_profile_id is distinct from current_setting('t.beneficiaire_user')::uuid then raise exception 'ECHEC: profile_id non rattache correctement (trouve %)', v_profile_id; end if;
  if v_statut is distinct from 'acceptee' then raise exception 'ECHEC: invitation non marquee acceptee (trouve %)', v_statut; end if;
  raise notice 'OK: finaliser_acces_beneficiaire rattache profile_id et marque l''invitation acceptee';
end $$;

-- rejouer le meme token ne fait plus rien (deja acceptee, jamais un ecrasement)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_ok boolean;
begin
  select public.finaliser_acces_beneficiaire(current_setting('t.token')) into v_ok;
  if v_ok is distinct from false then raise exception 'ECHEC: rejouer un token deja accepte aurait du echouer'; end if;
end $$;
reset role;
do $$
declare v_profile_id uuid;
begin
  select profile_id into v_profile_id from public.beneficiaires where id = current_setting('t.beneficiaire')::uuid;
  if v_profile_id is distinct from current_setting('t.beneficiaire_user')::uuid then
    raise exception 'ECHEC: profile_id a ete ecrase par un rejeu de token (trouve %)', v_profile_id;
  end if;
  raise notice 'OK: rejouer un token deja accepte n''ecrase jamais le rattachement existant';
end $$;

-- token expire refuse par finaliser_acces_beneficiaire aussi (pas seulement par la consultation)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_ok boolean;
begin
  select public.finaliser_acces_beneficiaire(current_setting('t.token_expire')) into v_ok;
  if v_ok is distinct from false then raise exception 'ECHEC: un token expire ne devrait jamais rattacher un profil'; end if;
end $$;
reset role;
do $$
declare v_profile_id uuid;
begin
  select profile_id into v_profile_id from public.beneficiaires where id = current_setting('t.beneficiaire2')::uuid;
  if v_profile_id is not null then raise exception 'ECHEC: un token expire a quand meme rattache un profil'; end if;
  raise notice 'OK: un token expire ne rattache jamais un profil';
end $$;

-- cloisonnement : une fois rattache, le beneficiaire voit sa propre fiche (deja garanti par
-- beneficiaires_select, verifie ici pour non-regression suite a l'ajout de la colonne)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.beneficiaire_user'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.beneficiaires where profile_id = current_setting('t.beneficiaire_user')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le beneficiaire rattache ne voit pas sa propre fiche (trouve %)', v_count; end if;
  raise notice 'OK: le beneficiaire rattache voit bien sa propre fiche via profile_id';
end $$;
-- et ne voit jamais la fiche d'un autre beneficiaire du meme praticien
do $$
declare v_count int;
begin
  select count(*) into v_count from public.beneficiaires where id = current_setting('t.beneficiaire2')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: le beneficiaire rattache voit la fiche d''un autre beneficiaire'; end if;
  raise notice 'OK: le beneficiaire rattache ne voit jamais la fiche d''un autre beneficiaire';
end $$;
reset role;

reset role;
rollback;
