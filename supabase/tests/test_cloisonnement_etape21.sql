-- Script de vérification T4 — garde-fou de quota IA + cloisonnement, Étape 21
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_org1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test21-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A21', 'structure', v_staff1) returning id into v_org1;
  -- quota par defaut = 100000 (pose par le trigger de bootstrap licence de l'Etape 2)

  perform set_config('test21.org1', v_org1::text, false);
  perform set_config('test21.staff1', v_staff1::text, false);
end $$;

-- consommation dans les limites : doit passer et incrementer le compteur
do $$
declare v_consomme int;
begin
  insert into public.consommations_ia (organisation_id, profile_id, nb_tokens) values (current_setting('test21.org1')::uuid, current_setting('test21.staff1')::uuid, 60000);
  select ia_tokens_consommes_mois_courant into v_consomme from public.quotas_organisations where organisation_id = current_setting('test21.org1')::uuid;
  if v_consomme <> 60000 then raise exception 'ECHEC: compteur de consommation IA=% attendu 60000', v_consomme; end if;
  raise notice 'OK: consommation IA dans la limite acceptee, compteur incremente correctement (60000)';
end $$;

-- consommation qui depasserait le quota (60000 + 50000 = 110000 > 100000) : doit etre rejetee
do $$
begin
  begin
    insert into public.consommations_ia (organisation_id, profile_id, nb_tokens) values (current_setting('test21.org1')::uuid, current_setting('test21.staff1')::uuid, 50000);
    raise exception 'ECHEC SECURITE: une consommation IA depassant le quota a ete acceptee';
  exception
    when others then
      raise notice 'OK SECURITE: consommation IA au-dela du quota rejetee par le garde-fou base de donnees';
  end;
end $$;

-- le compteur ne doit pas avoir bouge apres le rejet (toujours 60000, pas 110000)
do $$
declare v_consomme int;
begin
  select ia_tokens_consommes_mois_courant into v_consomme from public.quotas_organisations where organisation_id = current_setting('test21.org1')::uuid;
  if v_consomme <> 60000 then raise exception 'ECHEC: le compteur a change malgre le rejet (%)', v_consomme; end if;
  raise notice 'OK: le compteur reste a 60000 apres le rejet (transaction annulee proprement)';
end $$;

reset role;
rollback;
