-- Script de vérification T3 — cloisonnement + FAQ globale, Étape 22
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_org1 uuid;
  v_org2 uuid;
  v_ticket1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test22-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_staff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test22-staff2@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A22', 'structure', v_staff1) returning id into v_org1;
  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test B22', 'structure', v_staff2) returning id into v_org2;

  insert into public.tickets_support (organisation_id, profile_id, sujet) values (v_org1, v_staff1, 'Probleme test') returning id into v_ticket1;
  insert into public.reponses_support (ticket_id, profile_id, contenu) values (v_ticket1, v_staff1, 'Reponse test');
  insert into public.faq (question, reponse) values ('Comment ca marche ?', 'Reponse FAQ');

  perform set_config('test22.staff2', v_staff2::text, false);
end $$;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test22.staff2'), 'role', 'authenticated')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from public.tickets_support;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit un ticket de org1'; end if;
  select count(*) into v_count from public.reponses_support;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: staff2 voit une reponse de org1'; end if;
  raise notice 'OK cloisonnement Etape 22: 0 fuite tickets/reponses vers staff2 (autre organisation)';

  select count(*) into v_count from public.faq;
  if v_count <> 1 then raise exception 'ECHEC: staff2 ne voit pas la FAQ globale (% lignes)', v_count; end if;
  raise notice 'OK: la FAQ globale est visible par tout utilisateur authentifie';
end $$;

reset role;
rollback;
