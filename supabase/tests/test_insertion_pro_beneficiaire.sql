-- Vérification — accès bénéficiaire au module Insertion professionnelle
-- (migration 20260718000000_insertion_pro_acces_beneficiaire.sql)
begin;
set role postgres;

do $$
declare
  v_praticien uuid := gen_random_uuid();
  v_beneficiaire_user uuid := gen_random_uuid();
  v_autre_beneficiaire_user uuid := gen_random_uuid();
  v_org_a uuid;
  v_org_b uuid;
  v_beneficiaire_a uuid;
  v_beneficiaire_a2 uuid;
  v_entreprise uuid;
  v_offre_a uuid;
  v_offre_b uuid;
  v_candidature_a uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_praticien, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testinspro-praticien@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_beneficiaire_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testinspro-beneficiaire@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_autre_beneficiaire_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testinspro-autre@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org A Test InsPro', 'structure', v_praticien) returning id into v_org_a;
  insert into public.organisations (nom, type_organisation, created_by) values ('Org B Test InsPro', 'structure', v_praticien) returning id into v_org_b;

  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org_a, v_beneficiaire_user, 'Traore', 'Awa', 'actif', v_praticien) returning id into v_beneficiaire_a;
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org_a, v_autre_beneficiaire_user, 'Kone', 'Seydou', 'actif', v_praticien) returning id into v_beneficiaire_a2;

  insert into public.entreprises_partenaires (organisation_id, nom, secteur, created_by) values (v_org_a, 'Entreprise Test A', 'BTP', v_praticien) returning id into v_entreprise;
  insert into public.offres_emploi (organisation_id, entreprise_partenaire_id, titre, type_contrat, statut, created_by)
    values (v_org_a, v_entreprise, 'Offre Org A', 'cdd', 'ouverte', v_praticien) returning id into v_offre_a;
  insert into public.offres_emploi (organisation_id, titre, type_contrat, statut, created_by)
    values (v_org_b, 'Offre Org B', 'cdi', 'ouverte', v_praticien) returning id into v_offre_b;

  insert into public.candidatures (beneficiaire_id, organisation_id, offre_emploi_id, statut, created_by)
    values (v_beneficiaire_a, v_org_a, v_offre_a, 'soumise', v_praticien) returning id into v_candidature_a;
  insert into public.candidatures (beneficiaire_id, organisation_id, offre_emploi_id, statut, created_by)
    values (v_beneficiaire_a2, v_org_a, v_offre_a, 'soumise', v_praticien);

  perform set_config('t.beneficiaire_user', v_beneficiaire_user::text, false);
  perform set_config('t.org_a', v_org_a::text, false);
  perform set_config('t.org_b', v_org_b::text, false);
  perform set_config('t.offre_a', v_offre_a::text, false);
  perform set_config('t.offre_b', v_offre_b::text, false);
  perform set_config('t.candidature_a', v_candidature_a::text, false);
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.beneficiaire_user'), 'role', 'authenticated')::text, false);

-- Le bénéficiaire voit les offres/entreprises de SA propre organisation
do $$
declare v_count int;
begin
  select count(*) into v_count from public.offres_emploi where id = current_setting('t.offre_a')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le beneficiaire ne voit pas l''offre de sa propre organisation'; end if;
  raise notice 'OK: le beneficiaire voit l''offre de sa propre organisation';
end $$;

-- Cloisonnement : le bénéficiaire NE voit PAS les offres d'une autre organisation
do $$
declare v_count int;
begin
  select count(*) into v_count from public.offres_emploi where id = current_setting('t.offre_b')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: le beneficiaire voit une offre d''une autre organisation'; end if;
  raise notice 'OK cloisonnement: le beneficiaire ne voit pas l''offre d''une autre organisation';
end $$;

-- Le bénéficiaire voit SES propres candidatures
do $$
declare v_count int;
begin
  select count(*) into v_count from public.candidatures where id = current_setting('t.candidature_a')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le beneficiaire ne voit pas sa propre candidature'; end if;
  raise notice 'OK: le beneficiaire voit sa propre candidature';
end $$;

-- Cloisonnement : le bénéficiaire ne voit PAS les candidatures d'un autre bénéficiaire, même de la même organisation
do $$
declare v_count int;
begin
  select count(*) into v_count from public.candidatures where beneficiaire_id <> (
    select id from public.beneficiaires where profile_id = current_setting('t.beneficiaire_user')::uuid
  );
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: le beneficiaire voit la candidature d''un autre beneficiaire'; end if;
  raise notice 'OK cloisonnement: le beneficiaire ne voit pas la candidature d''un autre beneficiaire de la meme organisation';
end $$;

reset role;
rollback;
