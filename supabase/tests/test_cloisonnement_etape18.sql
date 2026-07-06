-- Script de vérification T3 — proposition automatique de réussite, Étape 18
begin;
set role postgres;

do $$
declare
  v_staff1 uuid := gen_random_uuid();
  v_org1 uuid;
  v_ben_ok uuid;
  v_ben_trop_tot uuid;
  v_ben_sans_projet uuid;
  v_insertion_ok uuid;
  v_insertion_trop_tot uuid;
  v_insertion_sans_projet uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (v_staff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test18-staff1@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Structure Test A18', 'structure', v_staff1) returning id into v_org1;

  -- cas 1 : beneficiaire avec projet de vie VALIDE, insertion demarree il y a 100 jours
  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'Kouame', 'Serge', v_staff1) returning id into v_ben_ok;
  insert into public.projets_vie (beneficiaire_id, organisation_id, titre, statut, created_by) values (v_ben_ok, v_org1, 'Devenir electricien', 'valide', v_staff1);
  insert into public.insertions_professionnelles (beneficiaire_id, organisation_id, type_insertion, date_debut, created_by) values (v_ben_ok, v_org1, 'emploi', current_date - 100, v_staff1) returning id into v_insertion_ok;

  -- cas 2 : meme situation mais insertion demarree il y a seulement 30 jours (trop tot)
  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'Diaby', 'Kadidia', v_staff1) returning id into v_ben_trop_tot;
  insert into public.projets_vie (beneficiaire_id, organisation_id, titre, statut, created_by) values (v_ben_trop_tot, v_org1, 'Devenir couturiere', 'valide', v_staff1);
  insert into public.insertions_professionnelles (beneficiaire_id, organisation_id, type_insertion, date_debut, created_by) values (v_ben_trop_tot, v_org1, 'emploi', current_date - 30, v_staff1) returning id into v_insertion_trop_tot;

  -- cas 3 : insertion mure (100 jours) mais PAS de projet de vie valide (encore en_construction)
  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org1, 'Silue', 'Adama', v_staff1) returning id into v_ben_sans_projet;
  insert into public.projets_vie (beneficiaire_id, organisation_id, titre, statut, created_by) values (v_ben_sans_projet, v_org1, 'Sans projet valide', 'en_construction', v_staff1);
  insert into public.insertions_professionnelles (beneficiaire_id, organisation_id, type_insertion, date_debut, created_by) values (v_ben_sans_projet, v_org1, 'emploi', current_date - 100, v_staff1) returning id into v_insertion_sans_projet;

  -- suivi "maintenu" pour les 3 cas
  insert into public.suivis_post_insertion (insertion_id, organisation_id, date_suivi, statut_maintien, created_by) values (v_insertion_ok, v_org1, current_date, 'maintenu', v_staff1);
  insert into public.suivis_post_insertion (insertion_id, organisation_id, date_suivi, statut_maintien, created_by) values (v_insertion_trop_tot, v_org1, current_date, 'maintenu', v_staff1);
  insert into public.suivis_post_insertion (insertion_id, organisation_id, date_suivi, statut_maintien, created_by) values (v_insertion_sans_projet, v_org1, current_date, 'maintenu', v_staff1);

  perform set_config('test18.ben_ok', v_ben_ok::text, false);
  perform set_config('test18.ben_trop_tot', v_ben_trop_tot::text, false);
  perform set_config('test18.ben_sans_projet', v_ben_sans_projet::text, false);
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.reussites_beneficiaires where beneficiaire_id = current_setting('test18.ben_ok')::uuid and statut = 'proposee_systeme';
  if v_count <> 1 then raise exception 'ECHEC: cas valide (projet valide + 100 jours maintenu) n''a pas propose de reussite (% lignes)', v_count; end if;
  raise notice 'OK: proposition automatique declenchee pour le cas conforme (projet de vie valide + maintien >= 3 mois)';

  select count(*) into v_count from public.reussites_beneficiaires where beneficiaire_id = current_setting('test18.ben_trop_tot')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: une reussite a ete proposee alors que le maintien est trop recent (30 jours)'; end if;
  raise notice 'OK: pas de proposition si le maintien est trop recent (< 3 mois)';

  select count(*) into v_count from public.reussites_beneficiaires where beneficiaire_id = current_setting('test18.ben_sans_projet')::uuid;
  if v_count <> 0 then raise exception 'ECHEC: une reussite a ete proposee sans projet de vie valide'; end if;
  raise notice 'OK: pas de proposition sans projet de vie valide, meme avec un maintien de 100 jours';
end $$;

reset role;
rollback;
