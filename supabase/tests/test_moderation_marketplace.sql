-- Vérification — modération Marketplace Fondateur (Valider/Suspendre/Supprimer)
-- NOTE : la vérification de log_audit_action() est incluse mais ne passera qu'une
-- fois la migration 20260716000000_log_audit_action_rpc.sql poussée sur cette base
-- (en attente de coordination avec une session concurrente au moment de l'écriture
-- de ce test — voir PLAN_MODERATION_MARKETPLACE.md, tâche A5).
begin;
set role postgres;

do $$
declare
  v_fondateur uuid;
  v_admin_org_a uuid := gen_random_uuid();
  v_tiers uuid := gen_random_uuid();
  v_org_a uuid;
  v_offre_a uuid;
begin
  select id into v_fondateur from auth.users where email = 'bleouaka1@gmail.com';
  if v_fondateur is null then
    v_fondateur := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (v_fondateur, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testmod-fondateurjetable@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');
  end if;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_admin_org_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testmod-admin-org-a@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}'),
    (v_tiers, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testmod-tiers@example.test', 'not-a-real-hash', now(), now(), now(), '{}', '{}');

  insert into public.organisations (nom, type_organisation, created_by) values ('Org A Test Moderation', 'employeur', v_admin_org_a) returning id into v_org_a;

  insert into public.membres_organisations (organisation_id, profile_id, statut) values (v_org_a, v_admin_org_a, 'actif')
    on conflict (organisation_id, profile_id) do nothing;
  insert into public.roles_utilisateurs (membre_organisation_id, role, actif)
    select id, 'administrateur', true from public.membres_organisations where organisation_id = v_org_a and profile_id = v_admin_org_a
    on conflict do nothing;

  insert into public.marketplace_offres (organisation_id, type_offre, titre, description, prix, created_by, image_couverture_url)
    values (v_org_a, 'produit', 'Offre Org A', 'Description', 5000, v_admin_org_a, 'https://example.test/cover.jpg') returning id into v_offre_a;

  -- publiee directement en contexte admin (contourne le trigger fondateur-only, deja verifie ailleurs)
  alter table public.marketplace_offres disable trigger enforce_marketplace_offre_statut;
  update public.marketplace_offres set statut = 'publiee' where id = v_offre_a;
  alter table public.marketplace_offres enable trigger enforce_marketplace_offre_statut;

  perform set_config('t.fondateur', v_fondateur::text, false);
  perform set_config('t.admin_org_a', v_admin_org_a::text, false);
  perform set_config('t.tiers', v_tiers::text, false);
  perform set_config('t.org_a', v_org_a::text, false);
  perform set_config('t.offre_a', v_offre_a::text, false);
end $$;

-- Cloisonnement : un tiers sans lien avec l'organisation ne peut PAS suspendre/supprimer l'offre d'autrui
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_rows int;
begin
  update public.marketplace_offres set statut = 'masquee' where id = current_setting('t.offre_a')::uuid;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'ECHEC cloisonnement: un tiers a pu suspendre l''offre d''une autre organisation'; end if;
  raise notice 'OK cloisonnement: un tiers ne peut pas suspendre l''offre d''une autre organisation (0 ligne affectee par RLS)';
end $$;
reset role;

-- L'administrateur de l'organisation propriétaire PEUT suspendre sa propre offre (peut_modifier)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.admin_org_a'), 'role', 'authenticated')::text, false);
do $$
declare v_statut text;
begin
  update public.marketplace_offres set statut = 'masquee' where id = current_setting('t.offre_a')::uuid;
  select statut into v_statut from public.marketplace_offres where id = current_setting('t.offre_a')::uuid;
  if v_statut <> 'masquee' then raise exception 'ECHEC: administrateur de l''organisation proprietaire n''a pas pu suspendre sa propre offre (statut=%)', v_statut; end if;
  raise notice 'OK: administrateur de l''organisation proprietaire peut suspendre sa propre offre';
end $$;
reset role;

-- Cloisonnement : un tiers ne peut pas non plus la supprimer (retiree)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.tiers'), 'role', 'authenticated')::text, false);
do $$
declare v_rows int;
begin
  update public.marketplace_offres set statut = 'retiree' where id = current_setting('t.offre_a')::uuid;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'ECHEC cloisonnement: un tiers a pu supprimer (retiree) l''offre d''une autre organisation'; end if;
  raise notice 'OK cloisonnement: un tiers ne peut pas supprimer (retiree) l''offre d''une autre organisation';
end $$;
reset role;

-- log_audit_action() : le profile_id est toujours auth.uid(), jamais falsifiable par l'appelant
-- (ne s'exécute que si la fonction existe déjà sur cette base — migration 20260716000000)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'log_audit_action') then
    perform set_config('t.audit_check', 'run', false);
  else
    perform set_config('t.audit_check', 'skip', false);
    raise notice 'IGNORE: log_audit_action() pas encore poussee sur cette base, verification sautee';
  end if;
end $$;

do $$
begin
  if current_setting('t.audit_check') = 'run' then
    perform set_config('request.jwt.claims', json_build_object('sub', current_setting('t.admin_org_a'), 'role', 'authenticated')::text, false);
    set role authenticated;
    perform public.log_audit_action('moderation_offre_suspendue', 'marketplace_offres', current_setting('t.offre_a')::uuid, jsonb_build_object('motif', 'test'), current_setting('t.org_a')::uuid);
    reset role;

    set role postgres;
    if not exists (
      select 1 from public.audit_logs
      where ligne_id = current_setting('t.offre_a')::uuid
        and action = 'moderation_offre_suspendue'
        and profile_id = current_setting('t.admin_org_a')::uuid
    ) then
      raise exception 'ECHEC: log_audit_action n''a pas enregistre profile_id = auth.uid() correctement';
    end if;
    raise notice 'OK: log_audit_action enregistre profile_id = auth.uid(), jamais falsifiable par l''appelant';
  end if;
end $$;

reset role;
rollback;
