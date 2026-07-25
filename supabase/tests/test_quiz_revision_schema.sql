-- Vérification — Module Quiz de révision, T1/8 (schéma + RLS)
begin;
set role postgres;

do $$
declare
  v_formateur uuid := gen_random_uuid();
  v_beneficiaire_a_user uuid := gen_random_uuid();
  v_beneficiaire_b_user uuid := gen_random_uuid();
  v_org uuid;
  v_beneficiaire_a uuid;
  v_beneficiaire_b uuid;
  v_document uuid;
  v_quiz uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_formateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testquizrev-formateur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_beneficiaire_a_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testquizrev-benef-a@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_beneficiaire_b_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testquizrev-benef-b@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org Test Quiz Revision', 'solo', v_formateur) returning id into v_org;

  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org, v_beneficiaire_a_user, 'Kone', 'Aminata', 'actif', v_formateur) returning id into v_beneficiaire_a;
  insert into public.beneficiaires (organisation_id, profile_id, nom, prenoms, statut_beneficiaire, created_by)
    values (v_org, v_beneficiaire_b_user, 'Sangare', 'Boubacar', 'actif', v_formateur) returning id into v_beneficiaire_b;

  insert into public.documents_beneficiaires (beneficiaire_id, organisation_id, type_document, nom_fichier, valide_par, valide_at, televerse_par)
    values (v_beneficiaire_a, v_org, 'formation', 'cours-menuiserie.pdf', v_formateur, now(), v_beneficiaire_a_user) returning id into v_document;

  insert into public.quiz_revision (document_id, beneficiaire_id, organisation_id, palier, niveau_difficulte, contenu_json, created_by)
    values (v_document, v_beneficiaire_a, v_org, 'gratuit', 'standard', '{"questions":[]}'::jsonb, v_beneficiaire_a_user) returning id into v_quiz;

  insert into public.credits_revision (beneficiaire_id, solde) values (v_beneficiaire_a, 10)
    on conflict (beneficiaire_id) do nothing;

  perform set_config('t.benef_a_user', v_beneficiaire_a_user::text, false);
  perform set_config('t.benef_b_user', v_beneficiaire_b_user::text, false);
  perform set_config('t.document', v_document::text, false);
  perform set_config('t.quiz', v_quiz::text, false);
  perform set_config('t.benef_a', v_beneficiaire_a::text, false);
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.benef_a_user'), 'role', 'authenticated')::text, false);

-- Le bénéficiaire voit son propre document (écart réel corrigé par cette migration)
do $$
declare v_count int;
begin
  select count(*) into v_count from public.documents_beneficiaires where id = current_setting('t.document')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le beneficiaire ne voit pas son propre document'; end if;
  raise notice 'OK: le beneficiaire voit son propre document (correctif RLS effectif)';
end $$;

-- Le bénéficiaire voit son propre quiz et son propre solde de crédits
do $$
declare v_count int; v_solde int;
begin
  select count(*) into v_count from public.quiz_revision where id = current_setting('t.quiz')::uuid;
  if v_count <> 1 then raise exception 'ECHEC: le beneficiaire ne voit pas son propre quiz'; end if;

  select solde into v_solde from public.credits_revision where beneficiaire_id = current_setting('t.benef_a')::uuid;
  if v_solde is null then raise exception 'ECHEC: le beneficiaire ne voit pas son propre solde de credits'; end if;

  raise notice 'OK: le beneficiaire voit son propre quiz et son solde de credits (%)', v_solde;
end $$;

-- credits_revision : aucune ecriture directe cote client, meme sur SA PROPRE ligne (reservee
-- aux fonctions serveur). Sans policy UPDATE, RLS ne leve pas d'exception : elle filtre
-- silencieusement a 0 ligne affectee (a verifier via ROW_COUNT, pas via une exception).
do $$
declare v_rows int;
begin
  update public.credits_revision set solde = 999 where beneficiaire_id = current_setting('t.benef_a')::uuid;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'ECHEC securite: le beneficiaire a pu modifier son propre solde directement (% ligne(s))', v_rows; end if;
  raise notice 'OK: meme le beneficiaire proprietaire ne peut pas ecrire directement sur credits_revision (0 ligne affectee par RLS)';
end $$;
reset role;

-- Cloisonnement : le bénéficiaire B ne voit ni le document, ni le quiz, ni le solde de A
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.benef_b_user'), 'role', 'authenticated')::text, false);
do $$
declare v_doc int; v_quiz_count int; v_credit int;
begin
  select count(*) into v_doc from public.documents_beneficiaires where id = current_setting('t.document')::uuid;
  select count(*) into v_quiz_count from public.quiz_revision where id = current_setting('t.quiz')::uuid;
  select count(*) into v_credit from public.credits_revision where beneficiaire_id = current_setting('t.benef_a')::uuid;
  if v_doc <> 0 or v_quiz_count <> 0 or v_credit <> 0 then
    raise exception 'ECHEC cloisonnement: le beneficiaire B voit des donnees du beneficiaire A (doc=%, quiz=%, credit=%)', v_doc, v_quiz_count, v_credit;
  end if;
  raise notice 'OK cloisonnement: le beneficiaire B ne voit rien du beneficiaire A';
end $$;
reset role;

reset role;
rollback;
