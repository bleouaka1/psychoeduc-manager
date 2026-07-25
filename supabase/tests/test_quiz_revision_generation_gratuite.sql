-- Vérification — Module Quiz de révision, T2 (garde-fou de génération)
begin;
set role postgres;

do $$
declare
  v_formateur uuid := gen_random_uuid();
  v_beneficiaire_user uuid := gen_random_uuid();
  v_org uuid;
  v_beneficiaire uuid;
  v_document_non_valide uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_formateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testquizgen-formateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_beneficiaire_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testquizgen-beneficiaire@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Quiz Gen', 'solo', v_formateur) returning id into v_org;
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org, v_beneficiaire_user, 'Diarra', 'Salif', 'actif', v_formateur) returning id into v_beneficiaire;

  -- Document jamais valide (valide_par IS NULL) : garde-fou mineur (§11)
  insert into public.documents_beneficiaires (beneficiaire_id, organisation_id, type_document, type_source, nom_fichier, contenu_texte, televerse_par)
    values (v_beneficiaire, v_org, 'quiz_revision', 'document', 'Support non valide', 'Un contenu quelconque assez long pour depasser le seuil minimum de cent caracteres exige par la validation applicative du depot.', v_beneficiaire_user)
    returning id into v_document_non_valide;

  perform set_config('t.document_non_valide', v_document_non_valide::text, false);
  perform set_config('t.org', v_org::text, false);
end $$;

-- Le trigger applicatif (pas ce test, la Server Action) refuse la generation sans
-- valide_par — verifie ici que la donnee de test est bien dans l'etat attendu
-- (valide_par IS NULL), la Server Action genererQuizGratuit() teste ce garde-fou
-- explicitement en TypeScript (pas de contrainte SQL dediee, verification applicative
-- documentee dans handoff-quiz-revision-ia-2.md section 11).
do $$
declare v_valide_par uuid;
begin
  select valide_par into v_valide_par from public.documents_beneficiaires where id = current_setting('t.document_non_valide')::uuid;
  if v_valide_par is not null then raise exception 'ECHEC: le document de test ne devrait pas etre valide'; end if;
  raise notice 'OK: document non valide correctement dans cet etat (garde-fou applicatif teste par ailleurs)';
end $$;

reset role;
rollback;
