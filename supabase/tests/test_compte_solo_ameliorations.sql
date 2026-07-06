-- Vérification — objectifs/jalons, avis, notifications, séances, correctif permission administrateur
begin;
set role postgres;

do $$
declare
  v_admin_solo uuid := gen_random_uuid(); -- proprietaire du compte Solo, role 'administrateur' (pas fondateur)
  v_acheteur uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org_solo uuid;
  v_beneficiaire uuid;
  v_formation uuid;
  v_inscription uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_admin_solo, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testameliorations-admin@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_acheteur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testameliorations-acheteur@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testameliorations-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  -- le trigger handle_new_organisation() cree automatiquement la membre_organisation + le role
  -- 'administrateur' pour created_by (bootstrap reel de tout compte Solo, pas de role 'fondateur' ici)
  insert into public.organisations (nom, type_organisation, created_by) values ('Solo Test Ameliorations', 'solo', v_admin_solo) returning id into v_org_solo;

  insert into public.beneficiaires (organisation_id, nom, prenoms, created_by) values (v_org_solo, 'Test', 'Beneficiaire', v_admin_solo) returning id into v_beneficiaire;

  insert into public.formations (organisation_id, titre, mode_transmission, prix, statut, created_by)
    values (v_org_solo, 'Formation Ameliorations', 'video_tutoriel', 10000, 'publiee', v_admin_solo) returning id into v_formation;

  insert into public.inscriptions_formations (formation_id, acheteur_id, organisation_id) values (v_formation, v_acheteur, v_org_solo) returning id into v_inscription;

  perform set_config('t.admin_solo', v_admin_solo::text, false);
  perform set_config('t.acheteur', v_acheteur::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org_solo', v_org_solo::text, false);
  perform set_config('t.beneficiaire', v_beneficiaire::text, false);
  perform set_config('t.formation', v_formation::text, false);
  perform set_config('t.inscription', v_inscription::text, false);
end $$;

-- Correctif permission : un compte Solo avec role 'administrateur' (pas fondateur) doit pouvoir
-- lire ses propres inscriptions/paiements (trou de securite/fonctionnalite corrige dans cette migration)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.admin_solo'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.inscriptions_formations where id = current_setting('t.inscription')::uuid;
  if v_count <> 1 then raise exception 'ECHEC correctif: administrateur du compte Solo ne voit pas sa propre inscription'; end if;
  raise notice 'OK correctif permission: administrateur (proprietaire Solo) voit ses inscriptions/paiements';
end $$;
reset role;

-- Notification auto a l'inscription : le proprietaire de l'organisation recoit une notification
do $$
declare v_count int;
begin
  select count(*) into v_count from public.notifications
    where profile_id = current_setting('t.admin_solo')::uuid and type_notification = 'inscription_formation';
  if v_count <> 1 then raise exception 'ECHEC: aucune notification generee a la nouvelle inscription (count=%)', v_count; end if;
  raise notice 'OK: notification automatique generee a la nouvelle inscription';
end $$;

-- Paiement confirme -> notification ; paiement non confirme -> pas de notification
insert into public.paiements_formation (inscription_id, montant, devise, statut)
  values (current_setting('t.inscription')::uuid, 10000, 'FCFA', 'initie');
do $$
declare v_count int;
begin
  select count(*) into v_count from public.notifications where profile_id = current_setting('t.admin_solo')::uuid and type_notification = 'paiement_formation';
  if v_count <> 0 then raise exception 'ECHEC: notification de paiement envoyee alors que le paiement n''est qu''initie'; end if;
  raise notice 'OK: aucune notification pour un paiement non confirme';
end $$;

insert into public.paiements_formation (inscription_id, montant, devise, statut)
  values (current_setting('t.inscription')::uuid, 10000, 'FCFA', 'confirme');
do $$
declare v_count int;
begin
  select count(*) into v_count from public.notifications where profile_id = current_setting('t.admin_solo')::uuid and type_notification = 'paiement_formation';
  if v_count <> 1 then raise exception 'ECHEC: notification de paiement confirme non generee (count=%)', v_count; end if;
  raise notice 'OK: notification automatique generee a la confirmation du paiement';
end $$;

-- Avis : un acheteur avec une inscription reelle peut laisser un avis, note moyenne calculee, notification generee
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.acheteur'), 'role', 'authenticated')::text, false);
insert into public.avis_formations (formation_id, organisation_id, acheteur_id, note, commentaire)
  values (current_setting('t.formation')::uuid, current_setting('t.org_solo')::uuid, current_setting('t.acheteur')::uuid, 4, 'Tres bonne formation');
reset role;

do $$
declare v_moyenne numeric; v_notif int;
begin
  select note_moyenne into v_moyenne from public.vue_notes_formations where formation_id = current_setting('t.formation')::uuid;
  if v_moyenne <> 4 then raise exception 'ECHEC: note moyenne incorrecte (%), attendu 4', v_moyenne; end if;
  select count(*) into v_notif from public.notifications where profile_id = current_setting('t.admin_solo')::uuid and type_notification = 'avis_formation';
  if v_notif <> 1 then raise exception 'ECHEC: notification de nouvel avis non generee'; end if;
  raise notice 'OK: avis enregistre, note moyenne = %, notification generee', v_moyenne;
end $$;

-- Un tiers SANS inscription ne peut pas laisser d'avis
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
begin
  begin
    insert into public.avis_formations (formation_id, organisation_id, acheteur_id, note)
      values (current_setting('t.formation')::uuid, current_setting('t.org_solo')::uuid, current_setting('t.tiers')::uuid, 5);
    raise exception 'ECHEC securite: un tiers sans inscription a pu laisser un avis';
  exception when insufficient_privilege or others then
    if sqlerrm like 'ECHEC%' then raise; end if;
    raise notice 'OK: un tiers sans inscription ne peut pas laisser d''avis (rejet RLS confirme)';
  end;
end $$;
reset role;

-- Objectifs/jalons : cloisonnement organisation (un tiers ne voit pas les objectifs d'un beneficiaire d'une autre org)
insert into public.objectifs_beneficiaire (beneficiaire_id, organisation_id, titre, statut)
  values (current_setting('t.beneficiaire')::uuid, current_setting('t.org_solo')::uuid, 'Trouver un stage', 'en_cours');

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_count int;
begin
  select count(*) into v_count from public.objectifs_beneficiaire where beneficiaire_id = current_setting('t.beneficiaire')::uuid;
  if v_count <> 0 then raise exception 'ECHEC cloisonnement: un tiers voit les objectifs d''un beneficiaire d''une autre organisation'; end if;
  raise notice 'OK cloisonnement: un tiers ne voit pas les objectifs/jalons d''un beneficiaire hors de son organisation';
end $$;
reset role;

-- Rappel de seance : une seance dans 12h sans rappel envoye declenche une notification et se marque rappel_envoye
insert into public.seances (organisation_id, beneficiaire_id, titre, type_seance, date_heure)
  values (current_setting('t.org_solo')::uuid, current_setting('t.beneficiaire')::uuid, 'Suivi mensuel', 'suivi', now() + interval '12 hours');

select public.verifier_rappels_seances(current_setting('t.org_solo')::uuid);

do $$
declare v_notif int; v_rappel_envoye boolean;
begin
  select count(*) into v_notif from public.notifications where profile_id = current_setting('t.admin_solo')::uuid and type_notification = 'rappel_seance';
  if v_notif <> 1 then raise exception 'ECHEC: rappel de seance non genere (count=%)', v_notif; end if;
  select rappel_envoye into v_rappel_envoye from public.seances where organisation_id = current_setting('t.org_solo')::uuid and titre = 'Suivi mensuel';
  if v_rappel_envoye is not true then raise exception 'ECHEC: rappel_envoye non marque a true apres notification'; end if;
  -- deuxieme appel : ne doit pas generer de doublon
  perform public.verifier_rappels_seances(current_setting('t.org_solo')::uuid);
  select count(*) into v_notif from public.notifications where profile_id = current_setting('t.admin_solo')::uuid and type_notification = 'rappel_seance';
  if v_notif <> 1 then raise exception 'ECHEC: rappel de seance envoye en double (count=%)', v_notif; end if;
  raise notice 'OK: rappel de seance genere une seule fois, rappel_envoye marque correctement';
end $$;

reset role;
rollback;
