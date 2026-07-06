--
-- PostgreSQL database dump
--

\restrict 3YtgtHI7w37k4z8jQIr2AzhfV5endrAmEMs008XayhHyYhuLL305aCPqGniXfVT

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: audit_table_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_table_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_action text;
  v_org uuid;
  v_row_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  -- Ne pas s'auto-auditer
  IF TG_TABLE_NAME = 'audit_logs' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSE
    v_action := TG_OP;
    v_old := NULL;
    v_new := NULL;
  END IF;

  -- Récupération robuste de organisation_id / id depuis le JSON
  v_org := COALESCE(
    (v_new->>'organisation_id')::uuid,
    (v_old->>'organisation_id')::uuid
  );

  v_row_id := COALESCE(
    (v_new->>'id')::uuid,
    (v_old->>'id')::uuid
  );

  INSERT INTO public.audit_logs (
    id,
    organisation_id,
    table_name,
    action,
    row_id,
    changed_by,
    changed_at,
    old_data,
    new_data
  )
  VALUES (
    gen_random_uuid(),
    v_org,
    TG_TABLE_NAME,
    v_action,
    v_row_id,
    (SELECT auth.uid()),
    NOW(),
    v_old,
    v_new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: audit_trigger_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if tg_table_name = 'audit_logs' then
    return null;
  end if;

  insert into public.audit_logs(organisation_id, user_id, action, table_name, record_id, details)
  values (
    coalesce(new.organisation_id, old.organisation_id),
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    jsonb_build_object('new', to_jsonb(new), 'old', to_jsonb(old))
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


--
-- Name: create_inscription_programme_from_activite(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_inscription_programme_from_activite() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_programme_id uuid;
  v_type_programme text;
  v_nom text;
begin
  -- seulement si jeune_id est présent
  if new.jeune_id is null then
    return new;
  end if;

  -- Mapping simple basé sur le type d'activité
  select a.type_activite into v_nom from public.activites a where a.id = new.activite_id;

  v_type_programme := case
    when v_nom = 'formation' then 'formation'
    when v_nom in ('orientation') then 'insertion_professionnelle'
    when v_nom in ('jeu_educatif','atelier','conference','sortie_decouverte','autre') then 'accompagnement_educatif'
    when v_nom = 'sport' then 'autonomie'
    else 'autre'
  end;

  select p.id into v_programme_id
  from public.programmes_suivi p
  where (p.organisation_id is null)
    and p.type_programme = v_type_programme
    and p.statut = 'actif'
  order by p.created_at desc
  limit 1;

  -- si aucun programme standard n'existe, ne rien faire (fallback non bloquant)
  if v_programme_id is null then
    return new;
  end if;

  -- éviter doublon si déjà créé
  if exists (
    select 1 from public.inscriptions_programmes ip
    where ip.inscription_activite_id = new.id
  ) then
    return new;
  end if;

  insert into public.inscriptions_programmes (
    id, programme_id, jeune_id, inscription_activite_id, statut,
    date_debut, objectif_personnel
  )
  values (
    gen_random_uuid(),
    v_programme_id,
    new.jeune_id,
    new.id,
    'en_cours',
    current_date,
    null
  );

  return new;
end;
$$;


--
-- Name: est_membre_organisation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.est_membre_organisation(p_organisation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1 from public.membres_organisations mo
    where mo.user_id = auth.uid()
      and mo.organisation_id = p_organisation_id
  );
$$;


--
-- Name: has_role(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(r text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
                              SELECT EXISTS (
                                  SELECT 1 FROM public.roles_utilisateurs
                                      WHERE user_id = auth.uid()
                                          AND role = r
                                              AND statut = 'actif'
                                                );
                                                $$;


--
-- Name: is_fondateur(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_fondateur() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1 from public.roles_utilisateurs ru
    where ru.user_id = auth.uid()
      and ru.role = 'fondateur'
  );
$$;


--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
              SELECT EXISTS (
                  SELECT 1 FROM public.super_admins
                      WHERE user_id = auth.uid()
                          AND statut = 'actif'
                            );
                            $$;


--
-- Name: module_actif(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.module_actif(p_organisation_id uuid, p_module text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select (
    public.is_fondateur()
    or exists (
      select 1
      from public.modules_actives ma
      where ma.organisation_id = p_organisation_id
        and ma.module = p_module
        and ma.actif = true
    )
    or exists (
      select 1
      from public.licences l
      where l.organisation_id = p_organisation_id
        and l.statut = 'actif'
        and (
          (l.modules_autorises ? p_module)
          or (l.modules_autorises @> jsonb_build_array(p_module))
        )
    )
  );
$$;


--
-- Name: peut_activer_suivi_independant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_activer_suivi_independant(eleve_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  return (
    exists (
      select 1
      from public.garants_suivi gs
      where gs.eleve_id = eleve_id
        and gs.statut = 'actif'
        and gs.autorise_suivi = true
    )
    or exists (
      select 1
      from public.abonnements_mentorat_psychoeduc am
      where am.eleve_id = eleve_id
        and am.statut = 'actif'
    )
    or exists (
      select 1
      from public.affectations_mentors_psychoeduc a
      where a.eleve_id = eleve_id
        and a.statut = 'active'
    )
  );
end;
$$;


--
-- Name: peut_creer(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_creer(p_module text, p_organisation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select (
    public.is_fondateur()
    or exists (
      select 1
      from public.permissions perm
      join public.roles_utilisateurs ru on ru.id = perm.role_utilisateur_id
      where ru.user_id = auth.uid()
        and perm.organisation_id = p_organisation_id
        and ru.organisation_id = p_organisation_id
        and perm.module = p_module
        and perm.peut_creer is true
    )
  );
$$;


--
-- Name: peut_ecrire_module(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_ecrire_module(p_module text, p_organisation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select public.module_actif(p_organisation_id, p_module);
$$;


--
-- Name: peut_lire(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_lire(p_module text, p_organisation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select (
    public.is_fondateur()
    or exists (
      select 1
      from public.permissions perm
      join public.roles_utilisateurs ru on ru.id = perm.role_utilisateur_id
      where ru.user_id = auth.uid()
        and perm.organisation_id = p_organisation_id
        and ru.organisation_id = p_organisation_id
        and ru.role = public.role_dans_organisation(p_organisation_id)
        and perm.module = p_module
        and perm.peut_lire is true
    )
  );
$$;


--
-- Name: peut_lire_module(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_lire_module(p_module text, p_organisation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select public.module_actif(p_organisation_id, p_module);
$$;


--
-- Name: peut_modifier(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_modifier(p_module text, p_organisation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select (
    public.is_fondateur()
    or exists (
      select 1
      from public.permissions perm
      join public.roles_utilisateurs ru on ru.id = perm.role_utilisateur_id
      where ru.user_id = auth.uid()
        and perm.organisation_id = p_organisation_id
        and ru.organisation_id = p_organisation_id
        and perm.module = p_module
        and perm.peut_modifier is true
    )
  );
$$;


--
-- Name: peut_supprimer(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_supprimer(p_module text, p_organisation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select (
    public.is_fondateur()
    or exists (
      select 1
      from public.permissions perm
      join public.roles_utilisateurs ru on ru.id = perm.role_utilisateur_id
      where ru.user_id = auth.uid()
        and perm.organisation_id = p_organisation_id
        and ru.organisation_id = p_organisation_id
        and perm.module = p_module
        and perm.peut_supprimer is true
    )
  );
$$;


--
-- Name: refuser_demande_abc(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refuser_demande_abc(demande_uuid uuid, admin_uuid uuid, commentaire text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            DECLARE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                ancien text;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                BEGIN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    SELECT statut INTO ancien
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        FROM public.demandes_acces_abc
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            WHERE id = demande_uuid;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                UPDATE public.demandes_acces_abc
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    SET
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            statut = 'refuse',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    valide_par = admin_uuid,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            commentaire_admin = commentaire,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    date_validation = now(),
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            updated_at = now()
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                WHERE id = demande_uuid;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    INSERT INTO public.historique_validations_abc (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            demande_id,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ancien_statut,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            nouveau_statut,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    action_par,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            commentaire
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                )
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    VALUES (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            demande_uuid,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ancien,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            'refuse',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    admin_uuid,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            commentaire
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                );

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    RETURN true;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    END;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    $$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: role_dans_organisation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.role_dans_organisation(p_organisation_id uuid) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select ru.role
  from public.roles_utilisateurs ru
  where ru.user_id = auth.uid()
    and ru.organisation_id = p_organisation_id
  limit 1;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: valider_demande_abc(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_demande_abc(demande_uuid uuid, admin_uuid uuid, commentaire text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
                                                                                                                                                                                                                                                                                                                                                                                                                                                        DECLARE
                                                                                                                                                                                                                                                                                                                                                                                                                                                            ancien text;
                                                                                                                                                                                                                                                                                                                                                                                                                                                            BEGIN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                SELECT statut INTO ancien
                                                                                                                                                                                                                                                                                                                                                                                                                                                                    FROM public.demandes_acces_abc
                                                                                                                                                                                                                                                                                                                                                                                                                                                                        WHERE id = demande_uuid;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                            UPDATE public.demandes_acces_abc
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                SET
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        statut = 'valide',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                valide_par = admin_uuid,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        commentaire_admin = commentaire,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                date_validation = now(),
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        updated_at = now()
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            WHERE id = demande_uuid;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                INSERT INTO public.historique_validations_abc (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        demande_id,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                ancien_statut,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        nouveau_statut,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                action_par,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        commentaire
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            )
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                VALUES (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        demande_uuid,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                ancien,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        'valide',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                admin_uuid,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        commentaire
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            );

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                RETURN true;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                END;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: abonnements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abonnements (
    id bigint NOT NULL,
    type_client text,
    client_id bigint,
    formule text,
    montant numeric DEFAULT 0,
    statut text DEFAULT 'actif'::text,
    date_debut date DEFAULT CURRENT_DATE,
    date_fin date,
    created_at timestamp without time zone DEFAULT now(),
    organisation_id uuid,
    updated_at timestamp with time zone
);


--
-- Name: abonnements_clients_abc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abonnements_clients_abc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    organisation_id uuid,
    structure_id uuid,
    instance_saas_id uuid,
    plan_id uuid,
    niveau_code text,
    periodicite text,
    statut text DEFAULT 'actif'::text,
    date_debut date DEFAULT CURRENT_DATE,
    date_fin date,
    montant numeric,
    devise text DEFAULT 'FCFA'::text,
    moyen_paiement text,
    reference_paiement text,
    renouvellement_auto boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: abonnements_emploi_premium; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abonnements_emploi_premium (
    id uuid NOT NULL,
    user_id uuid,
    plan_id uuid,
    statut text DEFAULT 'actif'::text,
    date_debut date,
    date_fin date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: abonnements_formateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abonnements_formateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formateur_id uuid,
    plan text,
    montant numeric,
    devise text DEFAULT 'FCFA'::text,
    date_debut date,
    date_fin date,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: abonnements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.abonnements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.abonnements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: abonnements_intelligence_economique; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abonnements_intelligence_economique (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    organisation_id uuid,
    plan_id uuid,
    type_abonne text DEFAULT 'particulier'::text,
    statut text DEFAULT 'actif'::text,
    date_debut date DEFAULT CURRENT_DATE,
    date_fin date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: abonnements_mentorat_psychoeduc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abonnements_mentorat_psychoeduc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_id uuid NOT NULL,
    plan_id uuid,
    statut text DEFAULT 'actif'::text NOT NULL,
    date_debut date,
    date_fin date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT abonnements_mentorat_psychoeduc_statut_check CHECK ((statut = ANY (ARRAY['actif'::text, 'inactif'::text, 'expiré'::text, 'résilié'::text])))
);


--
-- Name: abonnements_reseau_opportunites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abonnements_reseau_opportunites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profil_reseau_id uuid,
    plan_id uuid,
    statut text DEFAULT 'actif'::text,
    date_debut date DEFAULT CURRENT_DATE,
    date_fin date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: activites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titre text NOT NULL,
    type_activite text NOT NULL,
    description text,
    lieu text,
    date_debut date,
    date_fin date,
    heure_debut time without time zone,
    heure_fin time without time zone,
    nombre_places integer,
    prix numeric,
    devise text,
    statut text DEFAULT 'brouillon'::text NOT NULL,
    image_url text,
    lien_whatsapp text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT activites_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'publiée'::text, 'terminée'::text, 'annulée'::text]))),
    CONSTRAINT activites_type_activite_check CHECK ((type_activite = ANY (ARRAY['formation'::text, 'jeu_educatif'::text, 'sortie_decouverte'::text, 'atelier'::text, 'conference'::text, 'sport'::text, 'orientation'::text, 'autre'::text])))
);


--
-- Name: affectations_beneficiaires_personnel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affectations_beneficiaires_personnel (
    id bigint NOT NULL,
    beneficiaire_id bigint NOT NULL,
    personnel_structures_id bigint NOT NULL,
    role_suivi text DEFAULT 'referent'::text,
    statut text DEFAULT 'actif'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: affectations_beneficiaires_personnel_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.affectations_beneficiaires_personnel ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.affectations_beneficiaires_personnel_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: affectations_mentors_psychoeduc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affectations_mentors_psychoeduc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_id uuid NOT NULL,
    mentor_id uuid NOT NULL,
    statut text DEFAULT 'active'::text NOT NULL,
    date_debut date,
    date_fin date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT affectations_mentors_psychoeduc_statut_check CHECK ((statut = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: affectations_personnel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affectations_personnel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    personnel_structures_id bigint NOT NULL,
    role_utilisateur text NOT NULL,
    statut text DEFAULT 'actif'::text NOT NULL,
    date_debut timestamp with time zone DEFAULT now(),
    date_fin timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT affectations_personnel_statut_check CHECK ((statut = ANY (ARRAY['actif'::text, 'suspendu'::text, 'inactif'::text])))
);


--
-- Name: agents_ia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents_ia (
    id bigint NOT NULL,
    nom text NOT NULL,
    mission text,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: agents_ia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.agents_ia ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.agents_ia_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: agents_ia_psychoeduc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents_ia_psychoeduc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    nom text NOT NULL,
    mission text,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: alertes_emploi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alertes_emploi (
    id uuid NOT NULL,
    user_id uuid,
    organisation_id uuid,
    metier text,
    commune text,
    ville text,
    type_offre text,
    frequence text DEFAULT 'instantanee'::text,
    canal text DEFAULT 'whatsapp'::text,
    premium boolean DEFAULT false,
    statut text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metier_libre text,
    formation_libre text,
    competence_libre text,
    secteur_libre text,
    metier_ref_id uuid,
    formation_ref_id uuid,
    competence_ref_id uuid,
    secteur_ref_id uuid,
    metier_choix_source text,
    formation_choix_source text,
    competence_choix_source text,
    secteur_choix_source text
);


--
-- Name: alertes_intelligence_economique; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alertes_intelligence_economique (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    profil_ie_id uuid,
    categorie text,
    metier text,
    secteur text,
    ville text,
    commune text,
    frequence text DEFAULT 'instantanee'::text,
    canal text DEFAULT 'whatsapp'::text,
    premium boolean DEFAULT true,
    statut text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: alertes_suivi_independant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alertes_suivi_independant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_id uuid NOT NULL,
    type_alerte text,
    message text,
    statut text DEFAULT 'ouverte'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alertes_suivi_independant_statut_check CHECK ((statut = ANY (ARRAY['ouverte'::text, 'en_cours'::text, 'résolue'::text])))
);


--
-- Name: anciens_beneficiaires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anciens_beneficiaires (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid NOT NULL,
    programme text,
    annee integer,
    statut text,
    notes text,
    date_creation timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid,
    user_id uuid,
    action text NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: avis_formateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avis_formateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formateur_id uuid,
    auteur_nom text,
    auteur_type text,
    note integer,
    commentaire text,
    statut text DEFAULT 'en_attente'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: avis_reseau_opportunites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avis_reseau_opportunites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profil_reseau_id uuid,
    auteur_user_id uuid,
    auteur_nom text,
    auteur_type text DEFAULT 'beneficiaire'::text,
    note integer,
    commentaire text,
    statut text DEFAULT 'publie'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: badges_eleves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badges_eleves (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_id uuid NOT NULL,
    code text,
    nom text,
    statut text DEFAULT 'actif'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT badges_eleves_statut_check CHECK ((statut = ANY (ARRAY['actif'::text, 'inactif'::text])))
);


--
-- Name: beneficiaires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beneficiaires (
    id bigint NOT NULL,
    structure_id bigint,
    personnel_referent_id bigint,
    nom text NOT NULL,
    prenom text,
    sexe text,
    date_naissance date,
    filiere text,
    statut_suivi text DEFAULT 'suivi'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT beneficiaires_statut_suivi_check CHECK ((statut_suivi = ANY (ARRAY['suivi'::text, 'non_suivi'::text, 'ancien'::text, 'abandon'::text, 'insere'::text])))
);


--
-- Name: beneficiaires_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.beneficiaires_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: beneficiaires_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.beneficiaires_id_seq OWNED BY public.beneficiaires.id;


--
-- Name: campagnes_soutien; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campagnes_soutien (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titre text NOT NULL,
    objectif text,
    montant_cible numeric,
    montant_collecte numeric DEFAULT 0 NOT NULL,
    devise text,
    date_debut date,
    date_fin date,
    statut text DEFAULT 'active'::text NOT NULL,
    description text,
    lien_whatsapp text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campagnes_soutien_statut_check CHECK ((statut = ANY (ARRAY['active'::text, 'terminée'::text, 'suspendue'::text])))
);


--
-- Name: candidatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidatures (
    id uuid NOT NULL,
    offre_id uuid,
    profil_id uuid,
    jeune_id uuid,
    message text,
    cv_url text,
    statut text DEFAULT 'envoyee'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metier_libre text,
    formation_libre text,
    competence_libre text,
    secteur_libre text,
    metier_ref_id uuid,
    formation_ref_id uuid,
    competence_ref_id uuid,
    secteur_ref_id uuid,
    metier_choix_source text,
    formation_choix_source text,
    competence_choix_source text,
    secteur_choix_source text
);


--
-- Name: capital_social; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capital_social (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid NOT NULL,
    nom_contact text,
    type_relation text,
    niveau_soutien text,
    contact text
);


--
-- Name: citoyennete_leadership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.citoyennete_leadership (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid NOT NULL,
    competences_citoyennes text,
    leadership text,
    engagements text,
    besoins_soutien text,
    date_creation timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formation_id uuid,
    nom text NOT NULL,
    description text,
    formateur_id uuid,
    organisation_id uuid,
    statut text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: codes_promo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.codes_promo (
    id bigint NOT NULL,
    code text NOT NULL,
    type_code text,
    valeur numeric DEFAULT 0,
    duree_jours integer,
    actif boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    organisation_id uuid,
    updated_at timestamp with time zone
);


--
-- Name: codes_promo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.codes_promo ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.codes_promo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: commissions_plateforme; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commissions_plateforme (
    id bigint NOT NULL,
    source_type text,
    source_id bigint,
    montant_total numeric DEFAULT 0,
    taux_commission numeric DEFAULT 0,
    montant_commission numeric DEFAULT 0,
    montant_reverser numeric DEFAULT 0,
    statut text DEFAULT 'calcule'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: commissions_plateforme_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.commissions_plateforme ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.commissions_plateforme_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: competences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid,
    formateur_id uuid,
    educateur_id uuid,
    titre text NOT NULL,
    description text,
    categorie text,
    metier text,
    formation text,
    niveau text DEFAULT 'debutant'::text,
    type_competence text DEFAULT 'technique'::text,
    critere_validation text,
    statut text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: competences_eleves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competences_eleves (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competence_id uuid,
    eleve_formateur_id uuid,
    eleve_independant_id uuid,
    formateur_id uuid,
    educateur_id uuid,
    statut text DEFAULT 'a_apprendre'::text,
    progression numeric DEFAULT 0,
    commentaire_formateur text,
    date_attribution timestamp without time zone DEFAULT now(),
    date_validation timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: composants_dashboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.composants_dashboard (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_code text,
    titre text,
    type_composant text,
    source_vue text,
    configuration jsonb DEFAULT '{}'::jsonb,
    ordre integer DEFAULT 0,
    actif boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: concours_etat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concours_etat (
    id uuid NOT NULL,
    titre text,
    institution text,
    domaine text,
    niveau_requis text,
    pays text DEFAULT 'Côte d’Ivoire'::text,
    description text,
    date_ouverture date,
    date_limite date,
    lien_officiel text,
    frais numeric,
    statut text DEFAULT 'ouvert'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom_complet text NOT NULL,
    type_contact text NOT NULL,
    telephone text,
    whatsapp text,
    email text,
    adresse text,
    commune text,
    ville text,
    pays text,
    organisation text,
    fonction text,
    relation_avec_jeune text,
    jeune_id uuid,
    employeur_id uuid,
    niveau_importance integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contacts_type_contact_check CHECK ((type_contact = ANY (ARRAY['jeune'::text, 'parent'::text, 'employeur'::text, 'formateur'::text, 'mentor'::text, 'structure'::text, 'partenaire'::text, 'ancien_beneficiaire'::text, 'autre'::text])))
);


--
-- Name: contributions_financement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contributions_financement (
    id bigint NOT NULL,
    projet_id bigint,
    contributeur_nom text,
    montant numeric DEFAULT 0,
    statut text DEFAULT 'valide'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: contributions_financement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.contributions_financement ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.contributions_financement_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: deblocages_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deblocages_contacts (
    id uuid NOT NULL,
    utilisateur_id uuid,
    profil_id uuid,
    montant numeric,
    devise text DEFAULT 'FCFA'::text,
    statut_paiement text DEFAULT 'en_attente'::text,
    contact_debloque boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: demandes_acces_abc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandes_acces_abc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    niveau_code text NOT NULL,
    mode_creation text DEFAULT 'autonome'::text,
    type_demandeur text,
    nom_demandeur text,
    telephone text,
    whatsapp text,
    email text,
    nom_organisation text,
    type_organisation text,
    pays text DEFAULT 'Côte d''Ivoire'::text,
    ville text,
    commune text,
    adresse text,
    description text,
    pieces_justificatives jsonb DEFAULT '[]'::jsonb,
    statut text DEFAULT 'brouillon'::text,
    commentaire_admin text,
    valide_par uuid,
    date_soumission timestamp without time zone,
    date_validation timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: demandes_assistance_suivi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandes_assistance_suivi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_formateur_id uuid,
    formateur_id uuid,
    jeune_id uuid,
    type_assistance text NOT NULL,
    message text,
    priorite text,
    statut text DEFAULT 'en_attente'::text,
    reponse text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: demandes_creation_niveaux_abc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandes_creation_niveaux_abc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    niveau_code text NOT NULL,
    type_demande text DEFAULT 'creation_compte'::text,
    nom_demandeur text,
    telephone text,
    whatsapp text,
    email text,
    nom_structure text,
    type_structure text,
    pays text DEFAULT 'Côte d''Ivoire'::text,
    ville text,
    commune text,
    adresse text,
    description text,
    pieces_justificatives jsonb DEFAULT '[]'::jsonb,
    statut text DEFAULT 'en_attente'::text,
    commentaire_admin text,
    valide_par uuid,
    date_validation timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: demandes_reseau_opportunites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandes_reseau_opportunites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid,
    profil_reseau_id uuid,
    demandeur_user_id uuid,
    demandeur_nom text,
    demandeur_type text DEFAULT 'eleve'::text,
    telephone text,
    whatsapp text,
    email text,
    besoin text,
    objectif text,
    statut text DEFAULT 'nouvelle'::text,
    paiement_statut text DEFAULT 'non_paye'::text,
    montant_paye numeric DEFAULT 0,
    devise text DEFAULT 'FCFA'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: details_employeurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.details_employeurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    type_activite text,
    secteur text,
    pays text,
    ville text,
    adresse text,
    telephone text,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: details_ministeres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.details_ministeres (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    pays text,
    niveau_administration text,
    adresse text,
    telephone text,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: details_structures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.details_structures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    statut_juridique text,
    pays text,
    ville text,
    adresse text,
    telephone text,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: documents_beneficiaires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents_beneficiaires (
    id bigint NOT NULL,
    beneficiaire_id bigint NOT NULL,
    type_document text,
    titre text,
    fichier_url text,
    statut text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: documents_beneficiaires_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.documents_beneficiaires ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.documents_beneficiaires_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: donateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom_complet text NOT NULL,
    type_donateur text NOT NULL,
    telephone text,
    whatsapp text,
    email text,
    pays text,
    ville text,
    organisation text,
    fonction text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT donateurs_type_donateur_check CHECK ((type_donateur = ANY (ARRAY['particulier'::text, 'entreprise'::text, 'ONG'::text, 'association'::text, 'institution'::text, 'diaspora'::text, 'autre'::text])))
);


--
-- Name: dons_soutiens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dons_soutiens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    donateur_id uuid NOT NULL,
    type_soutien text NOT NULL,
    montant numeric,
    devise text,
    description text,
    objectif_finance text,
    beneficiaire_jeune_id uuid,
    statut text DEFAULT 'promis'::text NOT NULL,
    date_promesse date,
    date_reception date,
    preuve_paiement text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dons_soutiens_statut_check CHECK ((statut = ANY (ARRAY['promis'::text, 'reçu'::text, 'utilisé'::text, 'annulé'::text]))),
    CONSTRAINT dons_soutiens_type_soutien_check CHECK ((type_soutien = ANY (ARRAY['argent'::text, 'matériel'::text, 'formation'::text, 'mentorat'::text, 'stage'::text, 'emploi'::text, 'sponsoring'::text, 'autre'::text])))
);


--
-- Name: dossiers_beneficiaires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dossiers_beneficiaires (
    id bigint NOT NULL,
    beneficiaire_id bigint NOT NULL,
    titre text,
    description text,
    statut text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dossiers_beneficiaires_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.dossiers_beneficiaires ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.dossiers_beneficiaires_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: eleves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eleves (
    id bigint NOT NULL,
    nom text,
    prenom text,
    age integer,
    filiere text,
    statut text
);


--
-- Name: eleves_formateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eleves_formateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formateur_id uuid,
    jeune_id uuid,
    nom_apprenant text,
    telephone text,
    whatsapp text,
    email text,
    commune text,
    ville text,
    pays text DEFAULT 'Côte d’Ivoire'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: eleves_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.eleves ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.eleves_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: eleves_independants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eleves_independants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_source_id uuid,
    user_id uuid,
    statut text DEFAULT 'actif'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT eleves_independants_statut_check CHECK ((statut = ANY (ARRAY['actif'::text, 'inactif'::text])))
);


--
-- Name: employeurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employeurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid NOT NULL,
    nom text NOT NULL,
    adresse text,
    telephone text,
    contact_nom text,
    contact_telephone text,
    email text,
    date_creation timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: entretiens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entretiens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid NOT NULL,
    date_entretien date NOT NULL,
    theme text,
    observation text,
    recommandations text
);


--
-- Name: essais_gratuits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.essais_gratuits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    utilised boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: etapes_plans_intervention; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etapes_plans_intervention (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid,
    type_action text,
    description text,
    responsable_type text,
    responsable_id uuid,
    echeance date,
    statut text DEFAULT 'a_faire'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: etapes_programmes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etapes_programmes (
    id uuid NOT NULL,
    programme_id uuid,
    titre text,
    description text,
    ordre integer,
    delai_jours integer,
    type_etape text,
    created_at timestamp without time zone DEFAULT now(),
    metier_libre text,
    formation_libre text,
    competence_libre text,
    secteur_libre text,
    metier_ref_id uuid,
    formation_ref_id uuid,
    competence_ref_id uuid,
    secteur_ref_id uuid,
    metier_choix_source text,
    formation_choix_source text,
    competence_choix_source text,
    secteur_choix_source text
);


--
-- Name: formateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    organisation_id uuid,
    nom_complet text,
    photo_url text,
    type_formateur text,
    specialites text,
    matieres text,
    metiers text,
    description text,
    experience_annees integer,
    commune text,
    ville text,
    pays text DEFAULT 'Côte d’Ivoire'::text,
    telephone text,
    whatsapp text,
    email text,
    tarif numeric,
    devise text DEFAULT 'FCFA'::text,
    disponibilite text,
    nombre_eleves integer DEFAULT 0,
    note_moyenne numeric DEFAULT 0,
    statut text DEFAULT 'en_attente'::text,
    abonnement_marketplace text DEFAULT 'gratuit'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    mode_suivi text,
    assistance_psychoeduc text,
    nombre_suivis_realises integer DEFAULT 0,
    taux_reussite numeric DEFAULT 0,
    metier_libre text,
    formation_libre text,
    competence_libre text,
    secteur_libre text,
    metier_ref_id uuid,
    formation_ref_id uuid,
    competence_ref_id uuid,
    secteur_ref_id uuid,
    metier_choix_source text,
    formation_choix_source text,
    competence_choix_source text,
    secteur_choix_source text
);


--
-- Name: formations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titre text NOT NULL,
    description text,
    categorie text,
    niveau text,
    prix numeric DEFAULT 0,
    statut text DEFAULT 'brouillon'::text,
    createur_id uuid,
    organisation_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: formations_catalogue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formations_catalogue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formateur_id uuid,
    titre text,
    description text,
    categorie text,
    prix numeric,
    devise text DEFAULT 'FCFA'::text,
    duree text,
    mode text,
    ville text,
    statut text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metier_libre text,
    formation_libre text,
    competence_libre text,
    secteur_libre text,
    metier_ref_id uuid,
    formation_ref_id uuid,
    competence_ref_id uuid,
    secteur_ref_id uuid,
    metier_choix_source text,
    formation_choix_source text,
    competence_choix_source text,
    secteur_choix_source text
);


--
-- Name: fournisseurs_paiement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fournisseurs_paiement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    nom text NOT NULL,
    pays text DEFAULT 'Côte d''Ivoire'::text,
    actif boolean DEFAULT true,
    configuration jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: garants_suivi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garants_suivi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_id uuid NOT NULL,
    garant_user_id uuid NOT NULL,
    autorise_suivi boolean DEFAULT false NOT NULL,
    statut text DEFAULT 'actif'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT garants_suivi_statut_check CHECK ((statut = ANY (ARRAY['actif'::text, 'inactif'::text])))
);


--
-- Name: historique_validations_abc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historique_validations_abc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    demande_id uuid,
    ancien_statut text,
    nouveau_statut text,
    action_par uuid,
    commentaire text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: iga_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iga_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid NOT NULL,
    autonomie_personnelle numeric,
    autonomie_educative numeric,
    autonomie_professionnelle numeric,
    capital_social numeric,
    autonomie_economique numeric,
    insertion_sociopro numeric,
    score_global numeric
);


--
-- Name: implantations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.implantations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    nom_implantation text NOT NULL,
    pays text,
    ville text,
    adresse text,
    telephone text,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: incidents_disciplinaires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents_disciplinaires (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid,
    auteur_type text,
    auteur_nom text,
    categorie text,
    description text,
    date_incident date,
    gravite text,
    statut text DEFAULT 'ouvert'::text,
    actions_prise text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: inscriptions_activites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inscriptions_activites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activite_id uuid NOT NULL,
    nom_participant text NOT NULL,
    type_participant text NOT NULL,
    telephone text,
    whatsapp text,
    email text,
    jeune_id uuid,
    statut_inscription text DEFAULT 'en_attente'::text NOT NULL,
    paiement_statut text DEFAULT 'non_payé'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inscriptions_activites_paiement_statut_check CHECK ((paiement_statut = ANY (ARRAY['non_payé'::text, 'payé'::text, 'gratuit'::text]))),
    CONSTRAINT inscriptions_activites_statut_inscription_check CHECK ((statut_inscription = ANY (ARRAY['en_attente'::text, 'confirmée'::text, 'refusée'::text, 'annulée'::text]))),
    CONSTRAINT inscriptions_activites_type_participant_check CHECK ((type_participant = ANY (ARRAY['jeune'::text, 'parent'::text, 'professionnel'::text, 'bénévole'::text, 'partenaire'::text, 'autre'::text])))
);


--
-- Name: inscriptions_formations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inscriptions_formations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formation_id uuid,
    formateur_id uuid,
    jeune_id uuid,
    nom_apprenant text,
    telephone text,
    whatsapp text,
    email text,
    statut text DEFAULT 'en_attente'::text,
    paiement_statut text DEFAULT 'non_paye'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metier_libre text,
    formation_libre text,
    competence_libre text,
    secteur_libre text,
    metier_ref_id uuid,
    formation_ref_id uuid,
    competence_ref_id uuid,
    secteur_ref_id uuid,
    metier_choix_source text,
    formation_choix_source text,
    competence_choix_source text,
    secteur_choix_source text
);


--
-- Name: inscriptions_programmes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inscriptions_programmes (
    id uuid NOT NULL,
    programme_id uuid,
    jeune_id uuid,
    contact_id uuid,
    inscription_activite_id uuid,
    profil_recherche_emploi_id uuid,
    formateur_id uuid,
    objectif_personnel text,
    statut text DEFAULT 'en_cours'::text,
    date_debut date DEFAULT CURRENT_DATE,
    date_fin_prevue date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metier_libre text,
    formation_libre text,
    competence_libre text,
    secteur_libre text,
    metier_ref_id uuid,
    formation_ref_id uuid,
    competence_ref_id uuid,
    secteur_ref_id uuid,
    metier_choix_source text,
    formation_choix_source text,
    competence_choix_source text,
    secteur_choix_source text
);


--
-- Name: insertion_sociopro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insertion_sociopro (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid NOT NULL,
    employeur text,
    statut text,
    salaire numeric,
    date_debut date,
    observations text
);


--
-- Name: insertions_sociopro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insertions_sociopro (
    id bigint NOT NULL,
    beneficiaire_id bigint,
    type_insertion text,
    structure_accueil text,
    poste text,
    statut text DEFAULT 'en_cours'::text,
    date_debut date,
    date_fin date,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: insertions_sociopro_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.insertions_sociopro ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.insertions_sociopro_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: instances_saas_pays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instances_saas_pays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom_instance text NOT NULL,
    pays text,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: intelligence_economique; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intelligence_economique (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid NOT NULL,
    opportunite text,
    categorie text,
    description text,
    date_creation timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invitations_abc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations_abc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invite_par uuid,
    niveau_code text NOT NULL,
    email_invite text,
    telephone_invite text,
    nom_organisation text,
    type_organisation text,
    message_invitation text,
    token_invitation text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text),
    statut text DEFAULT 'envoyee'::text,
    date_expiration date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: invitations_utilisateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations_utilisateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    invite_par uuid,
    email_invite text NOT NULL,
    token_invitation text NOT NULL,
    role_utilisateur text NOT NULL,
    statut text DEFAULT 'envoyee'::text NOT NULL,
    date_expiration timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT invitations_utilisateurs_statut_check CHECK ((statut = ANY (ARRAY['envoyee'::text, 'expiree'::text, 'acceptee'::text, 'annulee'::text])))
);


--
-- Name: jeunes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jeunes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    age integer,
    sexe text,
    formation text,
    niveau_scolaire text,
    parent_tuteur text,
    contact_parent text,
    situation_familiale text,
    statut text,
    date_creation timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: licences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.licences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    type_licence text NOT NULL,
    statut text DEFAULT 'actif'::text NOT NULL,
    date_debut timestamp with time zone DEFAULT now() NOT NULL,
    date_fin timestamp with time zone,
    modules_autorises jsonb DEFAULT '[]'::jsonb NOT NULL,
    quota_utilisateurs integer,
    quota_beneficiaires integer,
    quota_stockage_bytes bigint,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: logs_acces_donnees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logs_acces_donnees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    super_admin_id uuid NOT NULL,
    organisation_id uuid,
    table_consultee text NOT NULL,
    action text NOT NULL,
    motif text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: membres_organisations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membres_organisations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: mentors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentors (
    id bigint NOT NULL,
    beneficiaire_id bigint NOT NULL,
    mentor_user_id uuid,
    nom text,
    telephone text,
    email text,
    statut text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mentors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.mentors ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.mentors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mentors_psychoeduc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentors_psychoeduc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mentor_user_id uuid NOT NULL,
    nom_complet text,
    statut text DEFAULT 'actif'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mentors_psychoeduc_statut_check CHECK ((statut = ANY (ARRAY['actif'::text, 'inactif'::text])))
);


--
-- Name: modules_actives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modules_actives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    module text NOT NULL,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: niveaux_abc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.niveaux_abc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    nom text NOT NULL,
    prix_mensuel numeric DEFAULT 0,
    prix_annuel numeric DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    description text,
    type_client text,
    devise text DEFAULT 'FCFA'::text,
    statut text DEFAULT 'actif'::text,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: objectifs_beneficiaires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objectifs_beneficiaires (
    id uuid NOT NULL,
    jeune_id uuid,
    contact_id uuid,
    type_objectif text,
    objectif text,
    indicateur_reussite text,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: objectifs_eleves_formateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objectifs_eleves_formateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_formateur_id uuid,
    formateur_id uuid,
    jeune_id uuid,
    titre text NOT NULL,
    description text,
    categorie text,
    indicateur text,
    cible numeric,
    unite text,
    periode_debut date,
    periode_fin date,
    priorite text,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: offres_emploi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offres_emploi (
    id uuid NOT NULL,
    organisation_id uuid,
    employeur_id uuid,
    titre text,
    description text,
    metier text,
    secteur text,
    type_offre text,
    type_contrat text,
    salaire_min numeric,
    salaire_max numeric,
    devise text DEFAULT 'FCFA'::text,
    commune text,
    ville text,
    pays text DEFAULT 'Côte d’Ivoire'::text,
    competences_requises text,
    experience_requise text,
    recruteur_nom text,
    recruteur_contact text,
    recruteur_whatsapp text,
    date_limite date,
    statut text DEFAULT 'publiee'::text,
    premium boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metier_libre text,
    formation_libre text,
    competence_libre text,
    secteur_libre text,
    metier_ref_id uuid,
    formation_ref_id uuid,
    competence_ref_id uuid,
    secteur_ref_id uuid,
    metier_choix_source text,
    formation_choix_source text,
    competence_choix_source text,
    secteur_choix_source text
);


--
-- Name: opportunites_economiques; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opportunites_economiques (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    categorie text NOT NULL,
    type_opportunite text,
    titre text NOT NULL,
    description text,
    metier text,
    secteur text,
    competence_requise text,
    niveau text,
    experience_requise text,
    ville text,
    commune text,
    pays text DEFAULT 'Côte d’Ivoire'::text,
    montant_min numeric,
    montant_max numeric,
    devise text DEFAULT 'FCFA'::text,
    salaire_moyen numeric,
    investissement_estime numeric,
    rentabilite_estimee text,
    source_nom text,
    source_contact text,
    source_whatsapp text,
    lien_source text,
    date_publication date DEFAULT CURRENT_DATE,
    date_expiration date,
    premium boolean DEFAULT false,
    statut text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: organisations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organisations (
    id uuid NOT NULL,
    type_organisation text,
    nom text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: pages_interface; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pages_interface (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    nom text NOT NULL,
    niveau_abc text,
    role_cible text,
    chemin text,
    icone text,
    ordre integer DEFAULT 0,
    actif boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: paiements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paiements (
    id bigint NOT NULL,
    user_id bigint,
    montant numeric DEFAULT 0,
    statut text DEFAULT 'en_attente'::text,
    moyen_paiement text,
    reference text,
    created_at timestamp without time zone DEFAULT now(),
    organisation_id uuid,
    updated_at timestamp with time zone
);


--
-- Name: paiements_abonnements_abc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paiements_abonnements_abc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    abonnement_id uuid,
    user_id uuid,
    organisation_id uuid,
    plan_id uuid,
    montant numeric,
    devise text DEFAULT 'FCFA'::text,
    moyen_paiement text,
    reference_paiement text,
    statut text DEFAULT 'en_attente'::text,
    date_paiement timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: paiements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.paiements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.paiements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: paiements_intelligence_economique; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paiements_intelligence_economique (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    abonnement_id uuid,
    plan_id uuid,
    montant numeric,
    devise text DEFAULT 'FCFA'::text,
    moyen_paiement text,
    reference_paiement text,
    statut text DEFAULT 'en_attente'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: parents_tuteurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parents_tuteurs (
    id bigint NOT NULL,
    beneficiaire_id bigint NOT NULL,
    nom text,
    prenom text,
    telephone text,
    email text,
    relation text,
    statut text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: parents_tuteurs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.parents_tuteurs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.parents_tuteurs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    role_utilisateur_id uuid NOT NULL,
    module text NOT NULL,
    peut_lire boolean DEFAULT false NOT NULL,
    peut_creer boolean DEFAULT false NOT NULL,
    peut_modifier boolean DEFAULT false NOT NULL,
    peut_supprimer boolean DEFAULT false NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: personnel_structures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnel_structures (
    id bigint NOT NULL,
    structure_id bigint,
    nom text NOT NULL,
    prenom text,
    role text NOT NULL,
    telephone text,
    email text,
    statut text DEFAULT 'actif'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT personnel_structures_role_check CHECK ((role = ANY (ARRAY['educateur'::text, 'formateur'::text, 'coordinateur'::text, 'psychologue'::text, 'assistant_social'::text, 'directeur'::text, 'autre'::text]))),
    CONSTRAINT personnel_structures_statut_check CHECK ((statut = ANY (ARRAY['actif'::text, 'inactif'::text, 'suspendu'::text])))
);


--
-- Name: personnel_structures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personnel_structures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personnel_structures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personnel_structures_id_seq OWNED BY public.personnel_structures.id;


--
-- Name: pieces_demandes_abc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pieces_demandes_abc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    demande_id uuid,
    type_piece text,
    titre text,
    fichier_url text,
    statut text DEFAULT 'soumise'::text,
    commentaire_verification text,
    verifie_par uuid,
    date_verification timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: pieces_identite_inscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pieces_identite_inscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    eleve_independant_id uuid,
    eleve_formateur_id uuid,
    type_personne text DEFAULT 'eleve'::text,
    nom_complet text,
    type_piece text,
    numero_piece text,
    pays_emission text DEFAULT 'Côte d’Ivoire'::text,
    date_emission date,
    date_expiration date,
    fichier_recto_url text,
    fichier_verso_url text,
    selfie_url text,
    statut_verification text DEFAULT 'en_attente'::text,
    commentaire_verification text,
    verifie_par uuid,
    date_verification timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: plans_abonnement_abc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans_abonnement_abc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    niveau_code text NOT NULL,
    nom text NOT NULL,
    description text,
    periodicite text NOT NULL,
    prix numeric DEFAULT 0 NOT NULL,
    devise text DEFAULT 'FCFA'::text,
    limite_dossiers integer,
    limite_utilisateurs integer,
    limite_stockage_go integer,
    modules_inclus jsonb DEFAULT '{}'::jsonb,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: plans_emploi_premium; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans_emploi_premium (
    id uuid NOT NULL,
    code text,
    nom text,
    prix numeric,
    devise text DEFAULT 'FCFA'::text,
    duree_jours integer,
    avantages jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: plans_intelligence_economique; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans_intelligence_economique (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    nom text NOT NULL,
    prix numeric DEFAULT 0,
    devise text DEFAULT 'FCFA'::text,
    duree_jours integer,
    description text,
    avantages jsonb DEFAULT '{}'::jsonb,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: plans_intervention_personnalises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans_intervention_personnalises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid,
    plan_titre text,
    objectif_global text,
    horizon text,
    statut text DEFAULT 'actif'::text,
    resume text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: plans_mentorat_psychoeduc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans_mentorat_psychoeduc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text,
    nom text,
    duree_jours integer,
    statut text DEFAULT 'actif'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plans_mentorat_psychoeduc_statut_check CHECK ((statut = ANY (ARRAY['actif'::text, 'inactif'::text, 'archivé'::text])))
);


--
-- Name: plans_reseau_opportunites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans_reseau_opportunites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    nom text NOT NULL,
    prix numeric DEFAULT 0,
    devise text DEFAULT 'FCFA'::text,
    duree_jours integer,
    avantages jsonb DEFAULT '{}'::jsonb,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: preuves_competences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preuves_competences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competence_eleve_id uuid,
    type_fichier text,
    fichier_url text,
    nom_fichier text,
    description text,
    commentaire_eleve text,
    statut text DEFAULT 'soumise'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    user_id uuid,
    organisation_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: profils; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profils (
    id uuid NOT NULL,
    nom text,
    prenom text,
    telephone text,
    photo text,
    email text,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profils_intelligence_economique; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profils_intelligence_economique (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    eleve_independant_id uuid,
    eleve_formateur_id uuid,
    jeune_id uuid,
    nom_complet text,
    telephone text,
    whatsapp text,
    email text,
    type_profil text DEFAULT 'chercheur_opportunite'::text,
    metiers_recherches text,
    competences text,
    formations_recherchees text,
    secteurs_interet text,
    ville text,
    commune text,
    pays text DEFAULT 'Côte d’Ivoire'::text,
    disponible boolean DEFAULT true,
    premium boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: profils_recherche_emploi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profils_recherche_emploi (
    id uuid NOT NULL,
    jeune_id uuid,
    user_id uuid,
    nom_complet text,
    photo_url text,
    metier_recherche text,
    competences text,
    experience text,
    niveau_etude text,
    disponibilite text,
    commune text,
    ville text,
    pays text DEFAULT 'Côte d’Ivoire'::text,
    salaire_souhaite numeric,
    cv_url text,
    visible boolean DEFAULT true,
    premium boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metier_libre text,
    formation_libre text,
    competence_libre text,
    secteur_libre text,
    metier_ref_id uuid,
    formation_ref_id uuid,
    competence_ref_id uuid,
    secteur_ref_id uuid,
    metier_choix_source text,
    formation_choix_source text,
    competence_choix_source text,
    secteur_choix_source text
);


--
-- Name: profils_reseau_opportunites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profils_reseau_opportunites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    organisation_id uuid,
    nom_complet text NOT NULL,
    photo_url text,
    type_profil text DEFAULT 'mentor'::text,
    titre_professionnel text,
    secteur text,
    metier text,
    ville text,
    commune text,
    pays text DEFAULT 'Côte d’Ivoire'::text,
    description text,
    experience_annees integer DEFAULT 0,
    telephone text,
    whatsapp text,
    email text,
    note_moyenne numeric DEFAULT 0,
    nombre_accompagnements integer DEFAULT 0,
    nombre_mises_relation integer DEFAULT 0,
    taux_reussite numeric DEFAULT 0,
    statut text DEFAULT 'en_attente'::text,
    premium boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: programmes_suivi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programmes_suivi (
    id uuid NOT NULL,
    organisation_id uuid,
    nom text,
    type_programme text,
    objectif_general text,
    duree_jours integer,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metier_libre text,
    formation_libre text,
    competence_libre text,
    secteur_libre text,
    metier_ref_id uuid,
    formation_ref_id uuid,
    competence_ref_id uuid,
    secteur_ref_id uuid,
    metier_choix_source text,
    formation_choix_source text,
    competence_choix_source text,
    secteur_choix_source text
);


--
-- Name: projet_de_vie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projet_de_vie (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid NOT NULL,
    vision text,
    objectifs text,
    plan_action text,
    suivi text,
    date_creation timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projets_financement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projets_financement (
    id bigint NOT NULL,
    beneficiaire_id bigint,
    titre text NOT NULL,
    description text,
    montant_demande numeric DEFAULT 0,
    montant_collecte numeric DEFAULT 0,
    statut text DEFAULT 'en_attente'::text,
    commission_plateforme numeric DEFAULT 5,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: projets_financement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.projets_financement ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.projets_financement_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: quotas_organisations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotas_organisations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    max_utilisateurs integer DEFAULT 0 NOT NULL,
    max_beneficiaires integer DEFAULT 0 NOT NULL,
    max_stockage_bytes bigint DEFAULT 0 NOT NULL,
    used_utilisateurs integer DEFAULT 0 NOT NULL,
    used_beneficiaires integer DEFAULT 0 NOT NULL,
    used_stockage_bytes bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: rapports_suivi_eleves_formateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rapports_suivi_eleves_formateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    suivi_id uuid,
    eleve_formateur_id uuid,
    formateur_id uuid,
    jeune_id uuid,
    objectif_id uuid,
    titre text,
    format text DEFAULT 'pdf'::text,
    fichier_url text,
    statut text DEFAULT 'en_attente'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: recherches_intelligence_economique; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recherches_intelligence_economique (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type_recherche text,
    mot_cle text,
    categorie text,
    ville text,
    commune text,
    pays text DEFAULT 'Côte d’Ivoire'::text,
    premium boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: recherches_travailleurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recherches_travailleurs (
    id uuid NOT NULL,
    recruteur_id uuid,
    metier text,
    competences text,
    commune text,
    ville text,
    experience_min text,
    disponibilite text,
    paiement_statut text DEFAULT 'non_paye'::text,
    statut text DEFAULT 'ouverte'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: recommandations_educatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommandations_educatives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid,
    source text,
    recommandation text,
    priorite text,
    statut text DEFAULT 'propose'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: recommandations_ia_psychoeduc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommandations_ia_psychoeduc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_id uuid,
    type_eleve text,
    categorie text,
    titre text,
    recommandation text,
    priorite text DEFAULT 'moyenne'::text,
    statut text DEFAULT 'proposee'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: recommandations_intelligence_economique; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommandations_intelligence_economique (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    profil_ie_id uuid,
    opportunite_id uuid,
    type_recommandation text,
    titre text,
    contenu text,
    score_pertinence numeric DEFAULT 0,
    priorite text DEFAULT 'moyenne'::text,
    source text DEFAULT 'systeme'::text,
    statut text DEFAULT 'proposee'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: referentiel_metiers_formations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referentiel_metiers_formations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type_element text NOT NULL,
    nom text NOT NULL,
    categorie text,
    sous_categorie text,
    description text,
    pays text,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT referentiel_metiers_formations_type_nom_chk CHECK ((type_element = ANY (ARRAY['metier'::text, 'formation'::text, 'service'::text, 'competence'::text, 'secteur'::text])))
);


--
-- Name: reservations_formateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservations_formateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formateur_id uuid,
    service_id uuid,
    nom_client text,
    type_client text,
    telephone text,
    whatsapp text,
    message text,
    statut text DEFAULT 'nouvelle'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: resultats_reseau_opportunites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resultats_reseau_opportunites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    demande_id uuid,
    resultat text,
    type_resultat text DEFAULT 'mise_en_relation'::text,
    succes boolean DEFAULT false,
    commentaire text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: risques_predictifs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risques_predictifs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid,
    score_risque numeric,
    type_risque text,
    modele text,
    periode date,
    explication text,
    statut text DEFAULT 'calculé'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: roles_utilisateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles_utilisateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    organisation_id uuid,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp with time zone,
    updated_by uuid
);


--
-- Name: sante_bien_etre; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sante_bien_etre (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid NOT NULL,
    situation_sante text,
    habitudes_de_vie text,
    besoins_soutien text,
    recommandation text,
    date_creation timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scores_iga; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scores_iga (
    id bigint NOT NULL,
    beneficiaire_id bigint,
    score numeric DEFAULT 0,
    periode text,
    annee integer,
    mois integer,
    commentaire text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: scores_iga_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.scores_iga ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.scores_iga_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: services_formateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services_formateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formateur_id uuid,
    titre text,
    type_service text,
    description text,
    prix numeric,
    devise text DEFAULT 'FCFA'::text,
    duree text,
    lieu text,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: services_reseau_opportunites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services_reseau_opportunites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profil_reseau_id uuid,
    titre text NOT NULL,
    type_service text DEFAULT 'conseil'::text,
    description text,
    secteur text,
    metier text,
    prix numeric DEFAULT 0,
    devise text DEFAULT 'FCFA'::text,
    duree text,
    conditions text,
    statut text DEFAULT 'actif'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: sessions_connexion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions_connexion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: soutiens_jeune; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.soutiens_jeune (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid,
    source_type text,
    source_id uuid,
    relation text,
    contribution_type text,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: stages_apprentissages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stages_apprentissages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid,
    employeur_id uuid,
    type_placement text,
    titre text,
    domaine text,
    date_debut date,
    date_fin date,
    statut text DEFAULT 'planifie'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: structures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.structures (
    id bigint NOT NULL,
    nom text NOT NULL,
    type_structure text NOT NULL,
    responsable text,
    telephone text,
    email text,
    adresse text,
    statut text DEFAULT 'en_attente'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT structures_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'actif'::text, 'suspendu'::text, 'refuse'::text, 'archive'::text])))
);


--
-- Name: structures_abc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.structures_abc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    type_structure text DEFAULT 'centre'::text NOT NULL,
    responsable_nom text,
    responsable_prenom text,
    telephone text,
    whatsapp text,
    email text,
    pays text DEFAULT 'Côte d''Ivoire'::text,
    ville text,
    commune text,
    quartier text,
    adresse text,
    description text,
    nombre_eleves integer DEFAULT 0,
    nombre_formateurs integer DEFAULT 0,
    nombre_educateurs integer DEFAULT 0,
    statut text DEFAULT 'en_attente'::text,
    date_creation timestamp without time zone DEFAULT now(),
    date_validation timestamp without time zone,
    created_by uuid,
    valide_par uuid,
    CONSTRAINT structures_abc_type_check CHECK ((type_structure = ANY (ARRAY['centre'::text, 'ong'::text, 'ecole'::text, 'lycee'::text, 'universite'::text, 'institution'::text, 'ministere'::text, 'entreprise'::text])))
);


--
-- Name: structures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.structures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: structures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.structures_id_seq OWNED BY public.structures.id;


--
-- Name: suggestions_referentiel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggestions_referentiel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type_element text NOT NULL,
    valeur_suggeree text NOT NULL,
    categorie_suggeree text,
    table_source text,
    champ_source text,
    utilisateur_id uuid,
    statut text DEFAULT 'en_attente'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: suivis_eleves_formateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suivis_eleves_formateurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_formateur_id uuid,
    formateur_id uuid,
    jeune_id uuid,
    objectif_id uuid,
    type_suivi text,
    date_suivi date DEFAULT CURRENT_DATE,
    resume text,
    evaluation numeric,
    observations text,
    progression text,
    statut text DEFAULT 'soumis'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: suivis_mentorat_psychoeduc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suivis_mentorat_psychoeduc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_id uuid NOT NULL,
    mentor_id uuid NOT NULL,
    statut text DEFAULT 'soumis'::text NOT NULL,
    type_suivi text,
    date_suivi date,
    resume text,
    observations text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT suivis_mentorat_psychoeduc_statut_check CHECK ((statut = ANY (ARRAY['soumis'::text, 'validé'::text, 'refusé'::text])))
);


--
-- Name: suivis_post_insertion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suivis_post_insertion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_id uuid,
    type_suivi text,
    date_cible date,
    date_effective date,
    resultat text,
    statut text DEFAULT 'planifie'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: suivis_programmes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suivis_programmes (
    id uuid NOT NULL,
    inscription_programme_id uuid,
    etape_id uuid,
    responsable_id uuid,
    titre text,
    observation text,
    statut text DEFAULT 'a_faire'::text,
    date_prevue date,
    date_realisation date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metier_libre text,
    formation_libre text,
    competence_libre text,
    secteur_libre text,
    metier_ref_id uuid,
    formation_ref_id uuid,
    competence_ref_id uuid,
    secteur_ref_id uuid,
    metier_choix_source text,
    formation_choix_source text,
    competence_choix_source text,
    secteur_choix_source text
);


--
-- Name: super_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.super_admins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nom_complet text,
    email text,
    statut text DEFAULT 'actif'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT super_admins_statut_check CHECK ((statut = ANY (ARRAY['actif'::text, 'suspendu'::text])))
);


--
-- Name: taches_ia_psychoeduc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.taches_ia_psychoeduc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid,
    user_id uuid,
    eleve_id uuid,
    type_eleve text,
    demande text,
    contexte jsonb DEFAULT '{}'::jsonb,
    resultat text,
    statut text DEFAULT 'en_attente'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: transactions_paiement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions_paiement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    abonnement_id uuid,
    fournisseur_code text,
    montant numeric NOT NULL,
    devise text DEFAULT 'FCFA'::text,
    reference_interne text DEFAULT encode(extensions.gen_random_bytes(12), 'hex'::text),
    reference_externe text,
    statut text DEFAULT 'initie'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: transactions_wallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions_wallet (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid NOT NULL,
    organisation_id uuid NOT NULL,
    amount numeric NOT NULL,
    direction text NOT NULL,
    reference text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    CONSTRAINT transactions_wallet_direction_check CHECK ((direction = ANY (ARRAY['credit'::text, 'debit'::text])))
);


--
-- Name: utilisateurs_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.utilisateurs_roles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: validations_competences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validations_competences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competence_eleve_id uuid,
    preuve_id uuid,
    validateur_id uuid,
    type_validateur text,
    decision text,
    note numeric,
    commentaire_validation text,
    recommandations text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: validations_suivi_independant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validations_suivi_independant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eleve_id uuid NOT NULL,
    valide_par_user_id uuid NOT NULL,
    statut text DEFAULT 'valide'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT validations_suivi_independant_statut_check CHECK ((statut = ANY (ARRAY['valide'::text, 'refusé'::text, 'en_attente'::text])))
);


--
-- Name: vue_dashboard_abonnements_abc; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_abonnements_abc WITH (security_invoker='true') AS
 SELECT ( SELECT count(*) AS count
           FROM public.plans_abonnement_abc) AS total_plans,
    ( SELECT count(*) AS count
           FROM public.abonnements_clients_abc) AS total_abonnements,
    ( SELECT count(*) AS count
           FROM public.abonnements_clients_abc
          WHERE (abonnements_clients_abc.statut = 'actif'::text)) AS abonnements_actifs,
    ( SELECT count(*) AS count
           FROM public.abonnements_clients_abc
          WHERE (abonnements_clients_abc.statut = 'expire'::text)) AS abonnements_expires,
    ( SELECT count(*) AS count
           FROM public.abonnements_clients_abc
          WHERE (abonnements_clients_abc.statut = 'suspendu'::text)) AS abonnements_suspendus,
    ( SELECT count(*) AS count
           FROM public.abonnements_clients_abc
          WHERE (abonnements_clients_abc.niveau_code = 'A'::text)) AS abonnements_a,
    ( SELECT count(*) AS count
           FROM public.abonnements_clients_abc
          WHERE (abonnements_clients_abc.niveau_code = 'B'::text)) AS abonnements_b,
    ( SELECT count(*) AS count
           FROM public.abonnements_clients_abc
          WHERE (abonnements_clients_abc.niveau_code = 'C'::text)) AS abonnements_c,
    ( SELECT count(*) AS count
           FROM public.abonnements_clients_abc
          WHERE (abonnements_clients_abc.periodicite = 'mensuel'::text)) AS abonnements_mensuels,
    ( SELECT count(*) AS count
           FROM public.abonnements_clients_abc
          WHERE (abonnements_clients_abc.periodicite = 'annuel'::text)) AS abonnements_annuels,
    ( SELECT COALESCE(sum(paiements_abonnements_abc.montant), (0)::numeric) AS "coalesce"
           FROM public.paiements_abonnements_abc
          WHERE (paiements_abonnements_abc.statut = 'confirme'::text)) AS revenus_confirmes,
    now() AS date_generation;


--
-- Name: vue_dashboard_educateur_formateur; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_educateur_formateur WITH (security_invoker='true') AS
 SELECT id AS mentor_psychoeduc_id,
    mentor_user_id AS user_id,
    ( SELECT (count(*))::integer AS count
           FROM public.suivis_mentorat_psychoeduc sm
          WHERE (sm.mentor_id = m.id)) AS suivis_count,
    ( SELECT max(sm.date_suivi) AS max
           FROM public.suivis_mentorat_psychoeduc sm
          WHERE (sm.mentor_id = m.id)) AS dernier_suivi_date,
    ( SELECT (count(*))::integer AS count
           FROM public.validations_suivi_independant v
          WHERE ((v.eleve_id IN ( SELECT sm2.eleve_id
                   FROM public.suivis_mentorat_psychoeduc sm2
                  WHERE (sm2.mentor_id = m.id))) AND (v.statut = 'valide'::text))) AS validations_validees_count
   FROM public.mentors_psychoeduc m
  WHERE (mentor_user_id = auth.uid());


--
-- Name: vue_dashboard_eleve_personnel; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_eleve_personnel WITH (security_invoker='true') AS
 SELECT id AS eleve_independant_id,
    user_id,
    statut AS eleve_statut,
    ( SELECT (count(*))::integer AS count
           FROM public.validations_suivi_independant v
          WHERE ((v.eleve_id = ei.id) AND (v.statut = 'valide'::text))) AS validations_validees_count,
    ( SELECT (count(*))::integer AS count
           FROM public.suivis_mentorat_psychoeduc sm
          WHERE (sm.eleve_id = ei.id)) AS suivis_mentorat_psychoeduc_count,
    ( SELECT max(sm.date_suivi) AS max
           FROM public.suivis_mentorat_psychoeduc sm
          WHERE (sm.eleve_id = ei.id)) AS dernier_suivi_date,
    ( SELECT (count(*))::integer AS count
           FROM public.alertes_suivi_independant a
          WHERE ((a.eleve_id = ei.id) AND (a.statut = ANY (ARRAY['ouverte'::text, 'en_cours'::text])))) AS alertes_actives_count,
    ( SELECT (count(*))::integer AS count
           FROM public.badges_eleves b
          WHERE ((b.eleve_id = ei.id) AND (b.statut = 'actif'::text))) AS badges_actifs_count,
    public.peut_activer_suivi_independant(id) AS peut_activiter_suivi
   FROM public.eleves_independants ei
  WHERE (user_id = auth.uid());


--
-- Name: vue_dashboard_fondateur_final; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_fondateur_final WITH (security_invoker='true') AS
 SELECT ( SELECT count(*) AS count
           FROM public.niveaux_abc) AS niveaux_abc,
    ( SELECT count(*) AS count
           FROM public.structures_abc) AS structures_abc,
    ( SELECT count(*) AS count
           FROM public.instances_saas_pays) AS instances_saas_c,
    ( SELECT count(*) AS count
           FROM public.demandes_acces_abc) AS demandes_abc,
    ( SELECT count(*) AS count
           FROM public.abonnements_clients_abc) AS abonnements_abc,
    ( SELECT count(*) AS count
           FROM public.transactions_paiement) AS transactions_paiement,
    ( SELECT count(*) AS count
           FROM public.agents_ia_psychoeduc) AS agents_ia,
    ( SELECT count(*) AS count
           FROM public.opportunites_economiques) AS opportunites_economiques,
    ( SELECT count(*) AS count
           FROM public.pages_interface) AS pages_interface,
    now() AS date_generation;


--
-- Name: vue_dashboard_formateurs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_formateurs WITH (security_invoker='true') AS
 WITH base AS (
         SELECT ef.formateur_id,
            ef.jeune_id
           FROM public.eleves_formateurs ef
          GROUP BY ef.formateur_id, ef.jeune_id
        ), agg_suivi AS (
         SELECT s.formateur_id,
            count(*) AS nombre_suivis_total,
            avg(s.evaluation) AS note_moyenne,
            count(*) FILTER (WHERE (lower(COALESCE(s.progression, ''::text)) ~~ '%reuss%'::text)) AS nombre_suivis_reussite
           FROM public.suivis_eleves_formateurs s
          GROUP BY s.formateur_id
        ), agg_obj AS (
         SELECT o.formateur_id,
            count(*) AS nombre_objectifs_total
           FROM public.objectifs_eleves_formateurs o
          GROUP BY o.formateur_id
        ), agg_demandes AS (
         SELECT d.formateur_id,
            count(*) AS nombre_demandes_assistance
           FROM public.demandes_assistance_suivi d
          GROUP BY d.formateur_id
        ), agg_services AS (
         SELECT sf.formateur_id,
            count(*) AS nombre_services
           FROM public.services_formateurs sf
          GROUP BY sf.formateur_id
        ), agg_formations AS (
         SELECT i.formateur_id,
            count(DISTINCT i.formation_id) AS nombre_formations
           FROM public.inscriptions_formations i
          GROUP BY i.formateur_id
        )
 SELECT f.id AS formateur_id,
    count(b.jeune_id) AS nombre_eleves,
    COALESCE(su.nombre_suivis_total, (0)::bigint) AS nombre_suivis_total,
    COALESCE(dem.nombre_demandes_assistance, (0)::bigint) AS nombre_demandes_assistance,
    su.note_moyenne,
        CASE
            WHEN (COALESCE(su.nombre_suivis_total, (0)::bigint) = 0) THEN (0)::numeric
            ELSE ((COALESCE(su.nombre_suivis_reussite, (0)::bigint))::numeric / (NULLIF(su.nombre_suivis_total, 0))::numeric)
        END AS taux_reussite,
    COALESCE(ser.nombre_services, (0)::bigint) AS nombre_services,
    COALESCE(fo.nombre_formations, (0)::bigint) AS nombre_formations
   FROM (((((public.formateurs f
     LEFT JOIN base b ON ((b.formateur_id = f.id)))
     LEFT JOIN agg_suivi su ON ((su.formateur_id = f.id)))
     LEFT JOIN agg_demandes dem ON ((dem.formateur_id = f.id)))
     LEFT JOIN agg_services ser ON ((ser.formateur_id = f.id)))
     LEFT JOIN agg_formations fo ON ((fo.formateur_id = f.id)))
  GROUP BY f.id, su.nombre_suivis_total, su.nombre_suivis_reussite, su.note_moyenne, dem.nombre_demandes_assistance, ser.nombre_services, fo.nombre_formations;


--
-- Name: vue_dashboard_garant_mentor; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_garant_mentor WITH (security_invoker='true') AS
 SELECT gs.id AS garants_suivi_id,
    gs.eleve_id,
    gs.garant_user_id AS user_id,
    gs.statut AS garant_statut,
    gs.autorise_suivi,
    ( SELECT (count(*))::integer AS count
           FROM public.validations_suivi_independant v
          WHERE ((v.eleve_id = gs.eleve_id) AND (v.statut = 'valide'::text))) AS validations_validees_count,
    ( SELECT (count(*))::integer AS count
           FROM public.alertes_suivi_independant a
          WHERE ((a.eleve_id = gs.eleve_id) AND (a.statut = ANY (ARRAY['ouverte'::text, 'en_cours'::text])))) AS alertes_actives_count,
    ( SELECT (count(*))::integer AS count
           FROM public.badges_eleves b
          WHERE ((b.eleve_id = gs.eleve_id) AND (b.statut = 'actif'::text))) AS badges_actifs_count,
    ( SELECT max(sm.date_suivi) AS max
           FROM public.suivis_mentorat_psychoeduc sm
          WHERE (sm.eleve_id = gs.eleve_id)) AS dernier_suivi_date,
    public.peut_activer_suivi_independant(gs.eleve_id) AS peut_activiter_suivi
   FROM public.garants_suivi gs
  WHERE (gs.garant_user_id = auth.uid())
UNION ALL
 SELECT NULL::uuid AS garants_suivi_id,
    a.eleve_id,
    m.mentor_user_id AS user_id,
    'active'::text AS garant_statut,
    true AS autorise_suivi,
    ( SELECT (count(*))::integer AS count
           FROM public.validations_suivi_independant v
          WHERE ((v.eleve_id = a.eleve_id) AND (v.statut = 'valide'::text))) AS validations_validees_count,
    ( SELECT (count(*))::integer AS count
           FROM public.alertes_suivi_independant al
          WHERE ((al.eleve_id = a.eleve_id) AND (al.statut = ANY (ARRAY['ouverte'::text, 'en_cours'::text])))) AS alertes_actives_count,
    ( SELECT (count(*))::integer AS count
           FROM public.badges_eleves b
          WHERE ((b.eleve_id = a.eleve_id) AND (b.statut = 'actif'::text))) AS badges_actifs_count,
    ( SELECT max(sm.date_suivi) AS max
           FROM public.suivis_mentorat_psychoeduc sm
          WHERE ((sm.eleve_id = a.eleve_id) AND (sm.mentor_id = a.mentor_id))) AS dernier_suivi_date,
    public.peut_activer_suivi_independant(a.eleve_id) AS peut_activiter_suivi
   FROM (public.affectations_mentors_psychoeduc a
     JOIN public.mentors_psychoeduc m ON ((m.id = a.mentor_id)))
  WHERE ((m.mentor_user_id = auth.uid()) AND (a.statut = 'active'::text));


--
-- Name: vue_dashboard_global_fondateur; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_global_fondateur WITH (security_invoker='true') AS
 SELECT ( SELECT count(*) AS count
           FROM public.organisations) AS total_organisations,
    ( SELECT count(*) AS count
           FROM public.profiles) AS total_utilisateurs,
    ( SELECT count(*) AS count
           FROM public.formateurs) AS total_formateurs,
    ( SELECT count(*) AS count
           FROM public.mentors_psychoeduc) AS total_mentors,
    ( SELECT count(*) AS count
           FROM public.jeunes) AS total_jeunes_centres,
    ( SELECT count(*) AS count
           FROM public.eleves_independants) AS total_eleves_independants,
    ( SELECT count(*) AS count
           FROM public.eleves_formateurs) AS total_eleves_formateurs,
    ( SELECT count(*) AS count
           FROM public.entretiens) AS total_entretiens,
    ( SELECT count(*) AS count
           FROM public.suivis_eleves_formateurs) AS total_suivis_formateurs,
    ( SELECT count(*) AS count
           FROM public.suivis_mentorat_psychoeduc) AS total_suivis_mentorat,
    ( SELECT count(*) AS count
           FROM public.objectifs_beneficiaires) AS total_objectifs,
    ( SELECT count(*) AS count
           FROM public.competences) AS total_competences,
    ( SELECT count(*) AS count
           FROM public.validations_competences) AS total_validations_competences,
    ( SELECT count(*) AS count
           FROM public.garants_suivi) AS total_garants,
    ( SELECT count(*) AS count
           FROM public.capital_social) AS total_capital_social,
    ( SELECT count(*) AS count
           FROM public.badges_eleves) AS total_badges,
    ( SELECT count(*) AS count
           FROM public.alertes_suivi_independant) AS total_alertes_suivi,
    ( SELECT count(*) AS count
           FROM public.employeurs) AS total_employeurs,
    ( SELECT count(*) AS count
           FROM public.offres_emploi) AS total_offres_emploi,
    ( SELECT count(*) AS count
           FROM public.candidatures) AS total_candidatures,
    ( SELECT count(*) AS count
           FROM public.concours_etat) AS total_concours,
    ( SELECT count(*) AS count
           FROM public.stages_apprentissages) AS total_stages,
    ( SELECT count(*) AS count
           FROM public.activites) AS total_activites,
    ( SELECT count(*) AS count
           FROM public.inscriptions_activites) AS total_inscriptions_activites,
    ( SELECT count(*) AS count
           FROM public.formations_catalogue) AS total_formations,
    ( SELECT count(*) AS count
           FROM public.inscriptions_formations) AS total_inscriptions_formations,
    ( SELECT count(*) AS count
           FROM public.donateurs) AS total_donateurs,
    ( SELECT count(*) AS count
           FROM public.dons_soutiens) AS total_dons,
    ( SELECT count(*) AS count
           FROM public.campagnes_soutien) AS total_campagnes,
    ( SELECT count(*) AS count
           FROM public.pieces_identite_inscriptions) AS total_pieces_identite,
    ( SELECT count(*) AS count
           FROM public.logs_acces_donnees) AS total_logs_acces,
    ( SELECT count(*) AS count
           FROM public.referentiel_metiers_formations) AS total_referentiel,
    ( SELECT count(*) AS count
           FROM public.suggestions_referentiel) AS total_suggestions_referentiel,
    now() AS date_generation;


--
-- Name: vue_dashboard_intelligence_economique; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_intelligence_economique WITH (security_invoker='true') AS
 SELECT ( SELECT count(*) AS count
           FROM public.opportunites_economiques) AS nombre_opportunites,
    ( SELECT count(*) AS count
           FROM public.opportunites_economiques
          WHERE (opportunites_economiques.categorie = 'emploi'::text)) AS nombre_offres_emploi,
    ( SELECT count(*) AS count
           FROM public.opportunites_economiques
          WHERE (opportunites_economiques.categorie = 'stage'::text)) AS nombre_stages,
    ( SELECT count(*) AS count
           FROM public.opportunites_economiques
          WHERE (opportunites_economiques.categorie = 'concours'::text)) AS nombre_concours,
    ( SELECT count(*) AS count
           FROM public.opportunites_economiques
          WHERE (opportunites_economiques.categorie = 'formation'::text)) AS nombre_formations,
    ( SELECT count(*) AS count
           FROM public.opportunites_economiques
          WHERE (opportunites_economiques.categorie = 'financement'::text)) AS nombre_financements,
    ( SELECT count(*) AS count
           FROM public.profils_intelligence_economique
          WHERE (profils_intelligence_economique.type_profil = 'recruteur'::text)) AS nombre_recruteurs,
    ( SELECT count(*) AS count
           FROM public.profils_intelligence_economique
          WHERE (profils_intelligence_economique.type_profil = 'travailleur'::text)) AS nombre_travailleurs_disponibles,
    ( SELECT count(*) AS count
           FROM public.abonnements_intelligence_economique
          WHERE (abonnements_intelligence_economique.statut = 'actif'::text)) AS nombre_abonnes_premium,
    ( SELECT count(*) AS count
           FROM public.opportunites_economiques
          WHERE (opportunites_economiques.statut = 'active'::text)) AS opportunites_actives,
    ( SELECT count(*) AS count
           FROM public.opportunites_economiques
          WHERE (opportunites_economiques.statut = 'expiree'::text)) AS opportunites_expirees,
    now() AS date_generation;


--
-- Name: vue_dashboard_paiements; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_paiements WITH (security_invoker='true') AS
 SELECT count(*) AS total_transactions,
    count(*) FILTER (WHERE (statut = 'confirme'::text)) AS paiements_confirmes,
    count(*) FILTER (WHERE (statut = 'echoue'::text)) AS paiements_echoues,
    COALESCE(sum(montant) FILTER (WHERE (statut = 'confirme'::text)), (0)::numeric) AS revenus_confirmes,
    now() AS date_generation
   FROM public.transactions_paiement;


--
-- Name: vue_dashboard_reseau_opportunites; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_reseau_opportunites WITH (security_invoker='true') AS
 SELECT ( SELECT count(*) AS count
           FROM public.profils_reseau_opportunites) AS total_profils_reseau,
    ( SELECT count(*) AS count
           FROM public.profils_reseau_opportunites
          WHERE (profils_reseau_opportunites.statut = 'actif'::text)) AS profils_actifs,
    ( SELECT count(*) AS count
           FROM public.profils_reseau_opportunites
          WHERE (profils_reseau_opportunites.premium = true)) AS profils_premium,
    ( SELECT count(*) AS count
           FROM public.services_reseau_opportunites) AS total_services,
    ( SELECT count(*) AS count
           FROM public.services_reseau_opportunites
          WHERE (services_reseau_opportunites.statut = 'actif'::text)) AS services_actifs,
    ( SELECT count(*) AS count
           FROM public.demandes_reseau_opportunites) AS total_demandes,
    ( SELECT count(*) AS count
           FROM public.demandes_reseau_opportunites
          WHERE (demandes_reseau_opportunites.statut = 'nouvelle'::text)) AS demandes_nouvelles,
    ( SELECT count(*) AS count
           FROM public.demandes_reseau_opportunites
          WHERE (demandes_reseau_opportunites.statut = 'terminee'::text)) AS demandes_terminees,
    ( SELECT count(*) AS count
           FROM public.resultats_reseau_opportunites
          WHERE (resultats_reseau_opportunites.succes = true)) AS mises_relation_reussies,
    ( SELECT count(*) AS count
           FROM public.avis_reseau_opportunites) AS total_avis,
    ( SELECT avg(avis_reseau_opportunites.note) AS avg
           FROM public.avis_reseau_opportunites) AS note_moyenne_globale,
    now() AS date_generation;


--
-- Name: vue_dashboard_structures_abc; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_structures_abc WITH (security_invoker='true') AS
 SELECT id,
    nom,
    type_structure,
    pays,
    ville,
    commune,
    statut,
    nombre_eleves,
    nombre_formateurs,
    nombre_educateurs,
    date_creation
   FROM public.structures_abc;


--
-- Name: vue_dashboard_super_admin; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dashboard_super_admin WITH (security_invoker='true') AS
 SELECT (0)::bigint AS total_solo,
    (0)::bigint AS solo_actifs,
    (0)::bigint AS solo_en_attente,
    (0)::bigint AS solo_suspendus,
    (0)::bigint AS solo_refuses,
    (0)::bigint AS solo_archives,
    ( SELECT count(*) AS count
           FROM public.structures) AS total_structures_inscrites,
    ( SELECT count(*) AS count
           FROM public.structures
          WHERE (structures.statut = 'actif'::text)) AS total_structures_actives,
    ( SELECT count(*) AS count
           FROM public.structures
          WHERE (structures.statut = 'en_attente'::text)) AS total_demandes,
    ( SELECT count(*) AS count
           FROM public.structures
          WHERE (structures.statut = 'suspendu'::text)) AS total_suspendues,
    ( SELECT count(*) AS count
           FROM public.structures
          WHERE (structures.statut = 'refuse'::text)) AS total_refusees,
    ( SELECT count(*) AS count
           FROM public.structures
          WHERE (structures.statut = 'archive'::text)) AS total_archivees,
    (0)::bigint AS total_ministeres,
    (0)::bigint AS ministeres_actifs,
    (0)::bigint AS ministeres_en_attente,
    (0)::bigint AS ministeres_suspendus,
    (0)::bigint AS ministeres_refuses,
    (0)::bigint AS ministeres_archives,
    ( SELECT count(*) AS count
           FROM public.employeurs) AS total_employeurs,
    ( SELECT count(*) AS count
           FROM public.employeurs) AS employeurs_actifs,
    (0)::bigint AS employeurs_en_attente,
    (0)::bigint AS employeurs_suspendus,
    (0)::bigint AS total_beneficiaires,
    (0)::bigint AS total_personnel,
    ( SELECT count(*) AS count
           FROM public.abonnements
          WHERE (abonnements.statut = 'actif'::text)) AS abonnements_actifs,
    ( SELECT COALESCE(sum(paiements.montant), (0)::numeric) AS "coalesce"
           FROM public.paiements
          WHERE (paiements.statut = 'valide'::text)) AS revenus,
    (0)::bigint AS total_presences,
    ( SELECT count(*) AS count
           FROM public.scores_iga) AS total_scores_iga,
    (0)::bigint AS capital_social_actif,
    (0)::bigint AS opportunites_actives,
    (0)::bigint AS total_insertions,
    ( SELECT count(*) AS count
           FROM public.projets_financement) AS total_projets_financement,
    ( SELECT count(*) AS count
           FROM public.agents_ia
          WHERE (agents_ia.statut = 'actif'::text)) AS agents_ia_actifs,
    (0)::bigint AS offres_publiees,
    ( SELECT count(*) AS count
           FROM public.projets_financement) AS recrutements_realises,
    (0)::bigint AS total_alertes,
    (0)::bigint AS total_logs;


--
-- Name: vue_demandes_validation_abc; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_demandes_validation_abc WITH (security_invoker='true') AS
 SELECT id,
    user_id,
    niveau_code,
    type_demande,
    nom_demandeur,
    telephone,
    whatsapp,
    email,
    nom_structure,
    type_structure,
    pays,
    ville,
    commune,
    statut,
    commentaire_admin,
    date_validation,
    created_at
   FROM public.demandes_creation_niveaux_abc
  ORDER BY created_at DESC;


--
-- Name: vue_progression_eleves_formateurs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_progression_eleves_formateurs WITH (security_invoker='true') AS
 WITH objectifs AS (
         SELECT ef_1.formateur_id,
            ef_1.id AS eleve_formateur_id,
            count(*) AS nombre_objectifs,
            count(*) FILTER (WHERE (o.statut ~~* '%atteint%'::text)) AS objectifs_atteints,
            count(*) FILTER (WHERE ((o.statut IS NULL) OR (o.statut !~~* '%atteint%'::text))) AS objectifs_en_cours
           FROM (public.eleves_formateurs ef_1
             LEFT JOIN public.objectifs_eleves_formateurs o ON ((o.eleve_formateur_id = ef_1.id)))
          GROUP BY ef_1.formateur_id, ef_1.id
        ), suivis AS (
         SELECT ef_1.formateur_id,
            ef_1.id AS eleve_formateur_id,
            count(*) AS nombre_suivis,
            max(s.date_suivi) AS dernier_suivi
           FROM (public.eleves_formateurs ef_1
             LEFT JOIN public.suivis_eleves_formateurs s ON ((s.eleve_formateur_id = ef_1.id)))
          GROUP BY ef_1.formateur_id, ef_1.id
        )
 SELECT ef.id AS eleve_formateur_id,
    j.nom AS nom_complet,
    ef.formateur_id,
    COALESCE(obj.nombre_objectifs, (0)::bigint) AS nombre_objectifs,
    COALESCE(obj.objectifs_en_cours, (0)::bigint) AS objectifs_en_cours,
    COALESCE(obj.objectifs_atteints, (0)::bigint) AS objectifs_atteints,
    COALESCE(su.nombre_suivis, (0)::bigint) AS nombre_suivis,
    su.dernier_suivi,
        CASE
            WHEN (COALESCE(obj.nombre_objectifs, (0)::bigint) = 0) THEN (0)::numeric
            ELSE ((COALESCE(obj.objectifs_atteints, (0)::bigint))::numeric / (NULLIF(obj.nombre_objectifs, 0))::numeric)
        END AS taux_progression,
        CASE
            WHEN (COALESCE(obj.nombre_objectifs, (0)::bigint) = 0) THEN 'aucun_objectif'::text
            WHEN (COALESCE(obj.objectifs_en_cours, (0)::bigint) > 0) THEN 'en_cours'::text
            ELSE 'complet'::text
        END AS statut_global
   FROM (((public.eleves_formateurs ef
     LEFT JOIN public.jeunes j ON ((j.id = ef.jeune_id)))
     LEFT JOIN objectifs obj ON ((obj.eleve_formateur_id = ef.id)))
     LEFT JOIN suivis su ON ((su.eleve_formateur_id = ef.id)));


--
-- Name: vue_statistiques_formateurs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_statistiques_formateurs WITH (security_invoker='true') AS
 SELECT f.id AS formateur_id,
    COALESCE(count(DISTINCT i.id), (0)::bigint) AS nombre_eleves_calcule,
    COALESCE(avg((a.note)::numeric) FILTER (WHERE (a.note IS NOT NULL)), (0)::numeric) AS note_moyenne_calcule
   FROM ((public.formateurs f
     LEFT JOIN public.inscriptions_formations i ON ((i.formateur_id = f.id)))
     LEFT JOIN public.avis_formateurs a ON ((a.formateur_id = f.id)))
  GROUP BY f.id;


--
-- Name: vue_stats_demandes_abc; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_stats_demandes_abc WITH (security_invoker='true') AS
 SELECT count(*) AS total_demandes,
    count(*) FILTER (WHERE (niveau_code = 'A'::text)) AS demandes_niveau_a,
    count(*) FILTER (WHERE (niveau_code = 'B'::text)) AS demandes_niveau_b,
    count(*) FILTER (WHERE (niveau_code = 'C'::text)) AS demandes_niveau_c,
    count(*) FILTER (WHERE (statut = 'brouillon'::text)) AS brouillons,
    count(*) FILTER (WHERE (statut = 'en_attente_validation'::text)) AS en_attente,
    count(*) FILTER (WHERE (statut = 'en_verification'::text)) AS en_verification,
    count(*) FILTER (WHERE (statut = 'valide'::text)) AS validees,
    count(*) FILTER (WHERE (statut = 'refuse'::text)) AS refusees,
    count(*) FILTER (WHERE (statut = 'a_corriger'::text)) AS a_corriger,
    count(*) FILTER (WHERE (statut = 'suspendu'::text)) AS suspendues,
    count(*) FILTER (WHERE (mode_creation = 'autonome'::text)) AS creations_autonomes,
    count(*) FILTER (WHERE (mode_creation = 'assistee_admin'::text)) AS creations_assistees,
    count(*) FILTER (WHERE (mode_creation = 'invitation_fondateur'::text)) AS invitations_fondateur,
    now() AS date_generation
   FROM public.demandes_acces_abc;


--
-- Name: vue_top_100_iga_annuel; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_top_100_iga_annuel WITH (security_invoker='true') AS
 SELECT b.id AS beneficiaire_id,
    b.nom,
    b.prenom,
    b.filiere,
    s.score,
    s.annee,
    rank() OVER (PARTITION BY s.annee ORDER BY s.score DESC) AS rang
   FROM (public.scores_iga s
     JOIN public.beneficiaires b ON ((b.id = s.beneficiaire_id)))
  WHERE (s.annee IS NOT NULL)
  ORDER BY s.annee DESC, s.score DESC
 LIMIT 100;


--
-- Name: vue_top_100_iga_mensuel; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_top_100_iga_mensuel WITH (security_invoker='on') AS
 SELECT b.id AS beneficiaire_id,
    b.nom,
    b.prenom,
    b.filiere,
    s.score,
    s.annee,
    s.mois,
    rank() OVER (PARTITION BY s.annee, s.mois ORDER BY s.score DESC) AS rang
   FROM (public.scores_iga s
     JOIN public.beneficiaires b ON ((b.id = s.beneficiaire_id)))
  WHERE ((s.annee IS NOT NULL) AND (s.mois IS NOT NULL))
  ORDER BY s.annee DESC, s.mois DESC, s.score DESC
 LIMIT 100;


--
-- Name: vue_validation_acces_abc; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_validation_acces_abc WITH (security_invoker='true') AS
 SELECT id,
    user_id,
    niveau_code,
    mode_creation,
    type_demandeur,
    nom_demandeur,
    telephone,
    whatsapp,
    email,
    nom_organisation,
    type_organisation,
    pays,
    ville,
    commune,
    statut,
    commentaire_admin,
    date_soumission,
    date_validation,
    created_at,
    ( SELECT count(*) AS count
           FROM public.pieces_demandes_abc p
          WHERE (p.demande_id = d.id)) AS nombre_pieces
   FROM public.demandes_acces_abc d
  ORDER BY created_at DESC;


--
-- Name: wallet_fondateur; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_fondateur (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    solde_fond jsonb DEFAULT '{}'::jsonb NOT NULL,
    solde_total numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: webhooks_paiement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhooks_paiement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fournisseur_code text,
    reference_externe text,
    payload jsonb,
    statut_traitement text DEFAULT 'recu'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: beneficiaires id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaires ALTER COLUMN id SET DEFAULT nextval('public.beneficiaires_id_seq'::regclass);


--
-- Name: personnel_structures id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_structures ALTER COLUMN id SET DEFAULT nextval('public.personnel_structures_id_seq'::regclass);


--
-- Name: structures id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structures ALTER COLUMN id SET DEFAULT nextval('public.structures_id_seq'::regclass);


--
-- Data for Name: abonnements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.abonnements (id, type_client, client_id, formule, montant, statut, date_debut, date_fin, created_at, organisation_id, updated_at) FROM stdin;
\.


--
-- Data for Name: abonnements_clients_abc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.abonnements_clients_abc (id, user_id, organisation_id, structure_id, instance_saas_id, plan_id, niveau_code, periodicite, statut, date_debut, date_fin, montant, devise, moyen_paiement, reference_paiement, renouvellement_auto, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: abonnements_emploi_premium; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.abonnements_emploi_premium (id, user_id, plan_id, statut, date_debut, date_fin, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: abonnements_formateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.abonnements_formateurs (id, formateur_id, plan, montant, devise, date_debut, date_fin, statut, created_at, updated_at) FROM stdin;
b08efe80-7bfc-48d7-bc07-b977fc8723b2	\N	pro	10000	FCFA	\N	\N	actif	2026-06-02 20:46:49.206754	2026-06-02 20:46:49.206754
11b027b2-953b-4032-9035-dbc30ec0f364	\N	simple	5000	FCFA	\N	\N	actif	2026-06-02 20:46:49.206754	2026-06-02 20:46:49.206754
de5ae2cf-b17f-42ae-bd37-0a430c15a6d2	\N	premium	25000	FCFA	\N	\N	actif	2026-06-02 20:46:49.206754	2026-06-02 20:46:49.206754
07155d82-85d9-4c66-86f7-fcc62ec95518	\N	gratuit	0	FCFA	\N	\N	actif	2026-06-02 20:46:49.206754	2026-06-02 20:46:49.206754
\.


--
-- Data for Name: abonnements_intelligence_economique; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.abonnements_intelligence_economique (id, user_id, organisation_id, plan_id, type_abonne, statut, date_debut, date_fin, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: abonnements_mentorat_psychoeduc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.abonnements_mentorat_psychoeduc (id, eleve_id, plan_id, statut, date_debut, date_fin, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: abonnements_reseau_opportunites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.abonnements_reseau_opportunites (id, profil_reseau_id, plan_id, statut, date_debut, date_fin, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: activites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activites (id, titre, type_activite, description, lieu, date_debut, date_fin, heure_debut, heure_fin, nombre_places, prix, devise, statut, image_url, lien_whatsapp, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: affectations_beneficiaires_personnel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.affectations_beneficiaires_personnel (id, beneficiaire_id, personnel_structures_id, role_suivi, statut, created_at) FROM stdin;
\.


--
-- Data for Name: affectations_mentors_psychoeduc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.affectations_mentors_psychoeduc (id, eleve_id, mentor_id, statut, date_debut, date_fin, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: affectations_personnel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.affectations_personnel (id, organisation_id, personnel_structures_id, role_utilisateur, statut, date_debut, date_fin, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: agents_ia; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agents_ia (id, nom, mission, statut, created_at) FROM stdin;
1	Rapport éducatif	Génération de rapports	actif	2026-06-14 01:36:35.868696
2	IGA	Analyse de l’autonomie	actif	2026-06-14 01:36:35.868696
3	Capital social	Analyse du réseau de soutien	actif	2026-06-14 01:36:35.868696
4	Insertion	Recommandations professionnelles	actif	2026-06-14 01:36:35.868696
5	Intelligence économique	Détection des opportunités	actif	2026-06-14 01:36:35.868696
\.


--
-- Data for Name: agents_ia_psychoeduc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agents_ia_psychoeduc (id, code, nom, mission, statut, created_at) FROM stdin;
c8284b76-8df3-4fff-aa39-c92a2618919f	rapport_educatif	Agent Rapport éducatif	Génération de rapports éducatifs	actif	2026-06-12 14:26:02.91715
2dde23b5-1b80-4aa7-a2b0-967a919251dc	iga	Agent IGA	Analyse de l autonomie	actif	2026-06-12 14:26:02.91715
b066d79e-ba17-4ae8-af19-93ab5385a28e	capital_social	Agent Capital Social	Analyse du capital social	actif	2026-06-12 14:26:02.91715
b204c2bc-2f19-4003-99ad-81d0c82f33d5	insertion	Agent Insertion	Recommandations insertion professionnelle	actif	2026-06-12 14:26:02.91715
01029907-8c0b-47d6-a1b4-48bedb02e2b5	risque_decrochage	Agent Risque	Détection des risques	actif	2026-06-12 14:26:02.91715
3f80861b-da5f-456c-b92a-37bd36ec9752	intelligence_economique	Agent Intelligence Économique	Recherche opportunités	actif	2026-06-12 14:26:02.91715
\.


--
-- Data for Name: alertes_emploi; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alertes_emploi (id, user_id, organisation_id, metier, commune, ville, type_offre, frequence, canal, premium, statut, created_at, updated_at, metier_libre, formation_libre, competence_libre, secteur_libre, metier_ref_id, formation_ref_id, competence_ref_id, secteur_ref_id, metier_choix_source, formation_choix_source, competence_choix_source, secteur_choix_source) FROM stdin;
\.


--
-- Data for Name: alertes_intelligence_economique; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alertes_intelligence_economique (id, user_id, profil_ie_id, categorie, metier, secteur, ville, commune, frequence, canal, premium, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: alertes_suivi_independant; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alertes_suivi_independant (id, eleve_id, type_alerte, message, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: anciens_beneficiaires; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.anciens_beneficiaires (id, jeune_id, programme, annee, statut, notes, date_creation) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, organisation_id, user_id, action, table_name, record_id, details, created_at) FROM stdin;
\.


--
-- Data for Name: avis_formateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.avis_formateurs (id, formateur_id, auteur_nom, auteur_type, note, commentaire, statut, created_at) FROM stdin;
\.


--
-- Data for Name: avis_reseau_opportunites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.avis_reseau_opportunites (id, profil_reseau_id, auteur_user_id, auteur_nom, auteur_type, note, commentaire, statut, created_at) FROM stdin;
\.


--
-- Data for Name: badges_eleves; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.badges_eleves (id, eleve_id, code, nom, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: beneficiaires; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.beneficiaires (id, structure_id, personnel_referent_id, nom, prenom, sexe, date_naissance, filiere, statut_suivi, created_at) FROM stdin;
\.


--
-- Data for Name: campagnes_soutien; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.campagnes_soutien (id, titre, objectif, montant_cible, montant_collecte, devise, date_debut, date_fin, statut, description, lien_whatsapp, created_at) FROM stdin;
\.


--
-- Data for Name: candidatures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.candidatures (id, offre_id, profil_id, jeune_id, message, cv_url, statut, created_at, updated_at, metier_libre, formation_libre, competence_libre, secteur_libre, metier_ref_id, formation_ref_id, competence_ref_id, secteur_ref_id, metier_choix_source, formation_choix_source, competence_choix_source, secteur_choix_source) FROM stdin;
\.


--
-- Data for Name: capital_social; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.capital_social (id, jeune_id, nom_contact, type_relation, niveau_soutien, contact) FROM stdin;
\.


--
-- Data for Name: citoyennete_leadership; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.citoyennete_leadership (id, jeune_id, competences_citoyennes, leadership, engagements, besoins_soutien, date_creation) FROM stdin;
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.classes (id, formation_id, nom, description, formateur_id, organisation_id, statut, created_at) FROM stdin;
\.


--
-- Data for Name: codes_promo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.codes_promo (id, code, type_code, valeur, duree_jours, actif, created_at, organisation_id, updated_at) FROM stdin;
1	ESSAI7	essai_gratuit	100	7	t	2026-06-14 01:36:35.868696	\N	\N
\.


--
-- Data for Name: commissions_plateforme; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commissions_plateforme (id, source_type, source_id, montant_total, taux_commission, montant_commission, montant_reverser, statut, created_at) FROM stdin;
\.


--
-- Data for Name: competences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.competences (id, organisation_id, formateur_id, educateur_id, titre, description, categorie, metier, formation, niveau, type_competence, critere_validation, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: competences_eleves; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.competences_eleves (id, competence_id, eleve_formateur_id, eleve_independant_id, formateur_id, educateur_id, statut, progression, commentaire_formateur, date_attribution, date_validation, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: composants_dashboard; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.composants_dashboard (id, page_code, titre, type_composant, source_vue, configuration, ordre, actif, created_at) FROM stdin;
\.


--
-- Data for Name: concours_etat; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.concours_etat (id, titre, institution, domaine, niveau_requis, pays, description, date_ouverture, date_limite, lien_officiel, frais, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contacts (id, nom_complet, type_contact, telephone, whatsapp, email, adresse, commune, ville, pays, organisation, fonction, relation_avec_jeune, jeune_id, employeur_id, niveau_importance, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: contributions_financement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contributions_financement (id, projet_id, contributeur_nom, montant, statut, created_at) FROM stdin;
\.


--
-- Data for Name: deblocages_contacts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deblocages_contacts (id, utilisateur_id, profil_id, montant, devise, statut_paiement, contact_debloque, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: demandes_acces_abc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.demandes_acces_abc (id, user_id, niveau_code, mode_creation, type_demandeur, nom_demandeur, telephone, whatsapp, email, nom_organisation, type_organisation, pays, ville, commune, adresse, description, pieces_justificatives, statut, commentaire_admin, valide_par, date_soumission, date_validation, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: demandes_assistance_suivi; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.demandes_assistance_suivi (id, eleve_formateur_id, formateur_id, jeune_id, type_assistance, message, priorite, statut, reponse, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: demandes_creation_niveaux_abc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.demandes_creation_niveaux_abc (id, user_id, niveau_code, type_demande, nom_demandeur, telephone, whatsapp, email, nom_structure, type_structure, pays, ville, commune, adresse, description, pieces_justificatives, statut, commentaire_admin, valide_par, date_validation, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: demandes_reseau_opportunites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.demandes_reseau_opportunites (id, service_id, profil_reseau_id, demandeur_user_id, demandeur_nom, demandeur_type, telephone, whatsapp, email, besoin, objectif, statut, paiement_statut, montant_paye, devise, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: details_employeurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.details_employeurs (id, organisation_id, type_activite, secteur, pays, ville, adresse, telephone, email, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: details_ministeres; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.details_ministeres (id, organisation_id, pays, niveau_administration, adresse, telephone, email, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: details_structures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.details_structures (id, organisation_id, statut_juridique, pays, ville, adresse, telephone, email, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: documents_beneficiaires; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.documents_beneficiaires (id, beneficiaire_id, type_document, titre, fichier_url, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: donateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.donateurs (id, nom_complet, type_donateur, telephone, whatsapp, email, pays, ville, organisation, fonction, notes, created_at) FROM stdin;
\.


--
-- Data for Name: dons_soutiens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dons_soutiens (id, donateur_id, type_soutien, montant, devise, description, objectif_finance, beneficiaire_jeune_id, statut, date_promesse, date_reception, preuve_paiement, notes, created_at) FROM stdin;
\.


--
-- Data for Name: dossiers_beneficiaires; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dossiers_beneficiaires (id, beneficiaire_id, titre, description, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: eleves; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.eleves (id, nom, prenom, age, filiere, statut) FROM stdin;
1	Kouassi	Jean	\N	Menuiserie	\N
2	Yao	Paul	\N	Élevage	\N
3	Konan	Armand	\N	Ferronnerie	\N
4	Bleou	Angenor	\N	Psychoéducation	\N
5	Kouassi	Jean	\N	Menuiserie	\N
6	Yao	Paul	\N	Élevage	\N
7	Konan	Armand	\N	Ferronnerie	\N
8	Bleou	Angenor	\N	Psychoéducation	\N
\.


--
-- Data for Name: eleves_formateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.eleves_formateurs (id, formateur_id, jeune_id, nom_apprenant, telephone, whatsapp, email, commune, ville, pays, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: eleves_independants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.eleves_independants (id, eleve_source_id, user_id, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: employeurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employeurs (id, jeune_id, nom, adresse, telephone, contact_nom, contact_telephone, email, date_creation) FROM stdin;
\.


--
-- Data for Name: entretiens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.entretiens (id, jeune_id, date_entretien, theme, observation, recommandations) FROM stdin;
\.


--
-- Data for Name: essais_gratuits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.essais_gratuits (id, organisation_id, started_at, ends_at, utilised, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: etapes_plans_intervention; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.etapes_plans_intervention (id, plan_id, type_action, description, responsable_type, responsable_id, echeance, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: etapes_programmes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.etapes_programmes (id, programme_id, titre, description, ordre, delai_jours, type_etape, created_at, metier_libre, formation_libre, competence_libre, secteur_libre, metier_ref_id, formation_ref_id, competence_ref_id, secteur_ref_id, metier_choix_source, formation_choix_source, competence_choix_source, secteur_choix_source) FROM stdin;
\.


--
-- Data for Name: formateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.formateurs (id, user_id, organisation_id, nom_complet, photo_url, type_formateur, specialites, matieres, metiers, description, experience_annees, commune, ville, pays, telephone, whatsapp, email, tarif, devise, disponibilite, nombre_eleves, note_moyenne, statut, abonnement_marketplace, created_at, updated_at, mode_suivi, assistance_psychoeduc, nombre_suivis_realises, taux_reussite, metier_libre, formation_libre, competence_libre, secteur_libre, metier_ref_id, formation_ref_id, competence_ref_id, secteur_ref_id, metier_choix_source, formation_choix_source, competence_choix_source, secteur_choix_source) FROM stdin;
\.


--
-- Data for Name: formations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.formations (id, titre, description, categorie, niveau, prix, statut, createur_id, organisation_id, created_at) FROM stdin;
\.


--
-- Data for Name: formations_catalogue; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.formations_catalogue (id, formateur_id, titre, description, categorie, prix, devise, duree, mode, ville, statut, created_at, updated_at, metier_libre, formation_libre, competence_libre, secteur_libre, metier_ref_id, formation_ref_id, competence_ref_id, secteur_ref_id, metier_choix_source, formation_choix_source, competence_choix_source, secteur_choix_source) FROM stdin;
\.


--
-- Data for Name: fournisseurs_paiement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fournisseurs_paiement (id, code, nom, pays, actif, configuration, created_at) FROM stdin;
35be3151-e242-4588-8967-5beaa4daa135	orange_money	Orange Money	Côte d'Ivoire	t	{}	2026-06-12 14:09:06.764218
437c7021-bbb4-43be-aecc-18a2a287ceda	mtn_money	MTN Money	Côte d'Ivoire	t	{}	2026-06-12 14:09:06.764218
36bccd3f-0b96-4a65-826d-bf7d78a70dfe	moov_money	Moov Money	Côte d'Ivoire	t	{}	2026-06-12 14:09:06.764218
10fe7ccd-7b5a-47c4-8255-80dd9a43a305	wave	Wave	Côte d'Ivoire	t	{}	2026-06-12 14:09:06.764218
1d8acb76-2e73-4e0b-a3e6-b4de75e2d07a	carte_bancaire	Carte bancaire	Côte d'Ivoire	t	{}	2026-06-12 14:09:06.764218
d7a6f541-489a-425f-82de-f1f950c7cdc4	virement	Virement bancaire	Côte d'Ivoire	t	{}	2026-06-12 14:09:06.764218
\.


--
-- Data for Name: garants_suivi; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.garants_suivi (id, eleve_id, garant_user_id, autorise_suivi, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: historique_validations_abc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.historique_validations_abc (id, demande_id, ancien_statut, nouveau_statut, action_par, commentaire, created_at) FROM stdin;
\.


--
-- Data for Name: iga_scores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.iga_scores (id, jeune_id, autonomie_personnelle, autonomie_educative, autonomie_professionnelle, capital_social, autonomie_economique, insertion_sociopro, score_global) FROM stdin;
\.


--
-- Data for Name: implantations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.implantations (id, organisation_id, nom_implantation, pays, ville, adresse, telephone, email, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: incidents_disciplinaires; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.incidents_disciplinaires (id, jeune_id, auteur_type, auteur_nom, categorie, description, date_incident, gravite, statut, actions_prise, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inscriptions_activites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inscriptions_activites (id, activite_id, nom_participant, type_participant, telephone, whatsapp, email, jeune_id, statut_inscription, paiement_statut, notes, created_at) FROM stdin;
\.


--
-- Data for Name: inscriptions_formations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inscriptions_formations (id, formation_id, formateur_id, jeune_id, nom_apprenant, telephone, whatsapp, email, statut, paiement_statut, created_at, updated_at, metier_libre, formation_libre, competence_libre, secteur_libre, metier_ref_id, formation_ref_id, competence_ref_id, secteur_ref_id, metier_choix_source, formation_choix_source, competence_choix_source, secteur_choix_source) FROM stdin;
\.


--
-- Data for Name: inscriptions_programmes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inscriptions_programmes (id, programme_id, jeune_id, contact_id, inscription_activite_id, profil_recherche_emploi_id, formateur_id, objectif_personnel, statut, date_debut, date_fin_prevue, created_at, updated_at, metier_libre, formation_libre, competence_libre, secteur_libre, metier_ref_id, formation_ref_id, competence_ref_id, secteur_ref_id, metier_choix_source, formation_choix_source, competence_choix_source, secteur_choix_source) FROM stdin;
\.


--
-- Data for Name: insertion_sociopro; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.insertion_sociopro (id, jeune_id, employeur, statut, salaire, date_debut, observations) FROM stdin;
\.


--
-- Data for Name: insertions_sociopro; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.insertions_sociopro (id, beneficiaire_id, type_insertion, structure_accueil, poste, statut, date_debut, date_fin, created_at) FROM stdin;
\.


--
-- Data for Name: instances_saas_pays; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.instances_saas_pays (id, nom_instance, pays, statut, created_at) FROM stdin;
\.


--
-- Data for Name: intelligence_economique; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.intelligence_economique (id, jeune_id, opportunite, categorie, description, date_creation) FROM stdin;
\.


--
-- Data for Name: invitations_abc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invitations_abc (id, invite_par, niveau_code, email_invite, telephone_invite, nom_organisation, type_organisation, message_invitation, token_invitation, statut, date_expiration, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invitations_utilisateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invitations_utilisateurs (id, organisation_id, invite_par, email_invite, token_invitation, role_utilisateur, statut, date_expiration, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: jeunes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.jeunes (id, nom, age, sexe, formation, niveau_scolaire, parent_tuteur, contact_parent, situation_familiale, statut, date_creation) FROM stdin;
\.


--
-- Data for Name: licences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.licences (id, organisation_id, type_licence, statut, date_debut, date_fin, modules_autorises, quota_utilisateurs, quota_beneficiaires, quota_stockage_bytes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: logs_acces_donnees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.logs_acces_donnees (id, super_admin_id, organisation_id, table_consultee, action, motif, created_at) FROM stdin;
\.


--
-- Data for Name: membres_organisations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.membres_organisations (id, organisation_id, user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mentors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mentors (id, beneficiaire_id, mentor_user_id, nom, telephone, email, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mentors_psychoeduc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mentors_psychoeduc (id, mentor_user_id, nom_complet, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: modules_actives; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.modules_actives (id, organisation_id, module, actif, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: niveaux_abc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.niveaux_abc (id, code, nom, prix_mensuel, prix_annuel, created_at, description, type_client, devise, statut, updated_at) FROM stdin;
a30a31ff-3891-45a8-bca9-cb21e9492f05	A	Éducateur individuel	30000	300000	2026-06-12 15:04:44.299398	Compte individuel éducateur/formateur	educateur_individuel	FCFA	actif	2026-06-12 15:04:44.299398
20939929-f9f9-432d-ab8a-0483f561e09d	B	Centre / ONG / École	75000	750000	2026-06-12 15:04:44.299398	Structure éducative ou sociale	centre_ong_ecole	FCFA	actif	2026-06-12 15:04:44.299398
a1db8fc2-9bcd-40c7-aaa6-a3c256bb8c74	C	SaaS Ministère / Pays	250000	2500000	2026-06-12 15:04:44.299398	Institution, ministère, pays ou réseau	saas_pays_ministere	FCFA	actif	2026-06-12 15:04:44.299398
\.


--
-- Data for Name: objectifs_beneficiaires; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.objectifs_beneficiaires (id, jeune_id, contact_id, type_objectif, objectif, indicateur_reussite, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: objectifs_eleves_formateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.objectifs_eleves_formateurs (id, eleve_formateur_id, formateur_id, jeune_id, titre, description, categorie, indicateur, cible, unite, periode_debut, periode_fin, priorite, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: offres_emploi; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.offres_emploi (id, organisation_id, employeur_id, titre, description, metier, secteur, type_offre, type_contrat, salaire_min, salaire_max, devise, commune, ville, pays, competences_requises, experience_requise, recruteur_nom, recruteur_contact, recruteur_whatsapp, date_limite, statut, premium, created_at, updated_at, metier_libre, formation_libre, competence_libre, secteur_libre, metier_ref_id, formation_ref_id, competence_ref_id, secteur_ref_id, metier_choix_source, formation_choix_source, competence_choix_source, secteur_choix_source) FROM stdin;
\.


--
-- Data for Name: opportunites_economiques; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.opportunites_economiques (id, categorie, type_opportunite, titre, description, metier, secteur, competence_requise, niveau, experience_requise, ville, commune, pays, montant_min, montant_max, devise, salaire_moyen, investissement_estime, rentabilite_estimee, source_nom, source_contact, source_whatsapp, lien_source, date_publication, date_expiration, premium, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organisations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organisations (id, type_organisation, nom, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: pages_interface; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pages_interface (id, code, nom, niveau_abc, role_cible, chemin, icone, ordre, actif, created_at) FROM stdin;
c3d39ba9-7c85-4f85-bdc3-ee815779c7f0	dashboard_fondateur	Dashboard Fondateur	GLOBAL	super_admin	/fondateur	\N	1	t	2026-06-12 14:29:23.838552
967b99cf-41b9-42b1-af58-758838e1c484	dashboard_a	Dashboard Educateur	A	educateur	/dashboard-a	\N	2	t	2026-06-12 14:29:23.838552
ce5ff657-af16-4218-b287-9233115acfe7	dashboard_formateur	Dashboard Formateur	A	formateur	/dashboard-formateur	\N	3	t	2026-06-12 14:29:23.838552
1dbf5b0d-7e12-485c-bbd5-a3e94f85884c	dashboard_b	Dashboard Centre ONG	B	gestionnaire_centre	/dashboard-b	\N	4	t	2026-06-12 14:29:23.838552
a5dea207-9acc-4b88-9795-d950062c830e	dashboard_c	Dashboard Ministere Pays	C	administrateur_pays	/dashboard-c	\N	5	t	2026-06-12 14:29:23.838552
05433119-9694-4a82-b94b-da6b45fb2753	gestion_eleves	Gestion Eleves	A	educateur	/eleves	\N	6	t	2026-06-12 14:29:23.838552
f1098b71-af73-4546-a9e2-89147fb413b6	competences	Competences	A	formateur	/competences	\N	7	t	2026-06-12 14:29:23.838552
a68df6ed-c0fc-4d72-abe0-45864f5834cd	intelligence_economique	Intelligence Economique	GLOBAL	utilisateur	/intelligence	\N	8	t	2026-06-12 14:29:23.838552
251639b1-81eb-4a3e-89bc-84edbf4dd18f	abonnements	Abonnements	GLOBAL	super_admin	/abonnements	\N	9	t	2026-06-12 14:29:23.838552
6d36ea68-340c-49fd-aa92-b4edf0160a68	validations_abc	Validations ABC	GLOBAL	super_admin	/validations	\N	10	t	2026-06-12 14:29:23.838552
\.


--
-- Data for Name: paiements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.paiements (id, user_id, montant, statut, moyen_paiement, reference, created_at, organisation_id, updated_at) FROM stdin;
\.


--
-- Data for Name: paiements_abonnements_abc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.paiements_abonnements_abc (id, abonnement_id, user_id, organisation_id, plan_id, montant, devise, moyen_paiement, reference_paiement, statut, date_paiement, created_at) FROM stdin;
\.


--
-- Data for Name: paiements_intelligence_economique; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.paiements_intelligence_economique (id, user_id, abonnement_id, plan_id, montant, devise, moyen_paiement, reference_paiement, statut, created_at) FROM stdin;
\.


--
-- Data for Name: parents_tuteurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.parents_tuteurs (id, beneficiaire_id, nom, prenom, telephone, email, relation, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permissions (id, organisation_id, role_utilisateur_id, module, peut_lire, peut_creer, peut_modifier, peut_supprimer, created_by, updated_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: personnel_structures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.personnel_structures (id, structure_id, nom, prenom, role, telephone, email, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pieces_demandes_abc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pieces_demandes_abc (id, demande_id, type_piece, titre, fichier_url, statut, commentaire_verification, verifie_par, date_verification, created_at) FROM stdin;
\.


--
-- Data for Name: pieces_identite_inscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pieces_identite_inscriptions (id, user_id, eleve_independant_id, eleve_formateur_id, type_personne, nom_complet, type_piece, numero_piece, pays_emission, date_emission, date_expiration, fichier_recto_url, fichier_verso_url, selfie_url, statut_verification, commentaire_verification, verifie_par, date_verification, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: plans_abonnement_abc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plans_abonnement_abc (id, code, niveau_code, nom, description, periodicite, prix, devise, limite_dossiers, limite_utilisateurs, limite_stockage_go, modules_inclus, statut, created_at, updated_at) FROM stdin;
7bfa9659-3260-4641-8e54-d0047e36b6bd	A_MENSUEL	A	PsychoÉduc Solo Mensuel	Éducateur, formateur ou accompagnateur individuel.	mensuel	30000	FCFA	100	1	5	{"iga": true, "preuves": true, "dossiers": true, "rapports": true, "insertion": true, "entretiens": true, "competences": true, "capital_social": true}	actif	2026-06-12 13:40:46.539346	2026-06-12 13:40:46.539346
3031fa10-4767-4458-850f-c73576502fb7	A_ANNUEL	A	PsychoÉduc Solo Annuel	Abonnement annuel pour éducateur, formateur ou accompagnateur individuel.	annuel	300000	FCFA	100	1	5	{"iga": true, "preuves": true, "dossiers": true, "rapports": true, "insertion": true, "entretiens": true, "competences": true, "capital_social": true}	actif	2026-06-12 13:40:46.539346	2026-06-12 13:40:46.539346
07b56483-f3a5-4de7-87d8-2cf82d3d5c17	B_MENSUEL	B	PsychoÉduc Centre Mensuel	Centre, ONG, école, établissement ou structure éducative.	mensuel	75000	FCFA	2000	20	100	{"preuves": true, "familles": true, "activites": true, "employeurs": true, "competences": true, "statistiques": true, "tableaux_bord": true, "post_insertion": true, "multi_educateurs": true}	actif	2026-06-12 13:40:46.539346	2026-06-12 13:40:46.539346
99cf0bf9-bdec-43ab-9179-a617c04f6b49	B_ANNUEL	B	PsychoÉduc Centre Annuel	Abonnement annuel pour centres, ONG, écoles et établissements.	annuel	750000	FCFA	2000	20	100	{"preuves": true, "familles": true, "activites": true, "employeurs": true, "competences": true, "statistiques": true, "tableaux_bord": true, "post_insertion": true, "multi_educateurs": true}	actif	2026-06-12 13:40:46.539346	2026-06-12 13:40:46.539346
cc6b3f4d-93d4-4dde-970d-d0472178a314	C_MENSUEL_STANDARD	C	PsychoÉduc Africa Standard Mensuel	Réseaux, institutions, ministères et grandes structures.	mensuel	250000	FCFA	\N	\N	\N	{"ia": true, "api": true, "multi_pays": true, "multi_sites": true, "supervision": true, "statistiques_avancees": true, "intelligence_economique": true}	actif	2026-06-12 13:40:46.539346	2026-06-12 13:40:46.539346
d7e1e66c-8997-4f31-9128-ec642c38f85b	C_ANNUEL_STANDARD	C	PsychoÉduc Africa Standard Annuel	Abonnement annuel standard pour institutions et grandes structures.	annuel	2500000	FCFA	\N	\N	\N	{"ia": true, "api": true, "multi_pays": true, "multi_sites": true, "supervision": true, "statistiques_avancees": true, "intelligence_economique": true}	actif	2026-06-12 13:40:46.539346	2026-06-12 13:40:46.539346
5895c441-b5b6-4203-906b-1b000d61fa54	C_MENSUEL_PREMIUM	C	PsychoÉduc Africa Premium Mensuel	Version premium pour ministères, pays, réseaux nationaux et grandes institutions.	mensuel	500000	FCFA	\N	\N	\N	{"api": true, "ia_avancee": true, "multi_pays": true, "multi_sites": true, "statistiques_avancees": true, "supervision_nationale": true, "intelligence_economique": true, "accompagnement_prioritaire": true}	actif	2026-06-12 13:40:46.539346	2026-06-12 13:40:46.539346
ca0ff4e7-8659-44f1-a7cf-54453fdc1fb0	C_ANNUEL_PREMIUM	C	PsychoÉduc Africa Premium Annuel	Abonnement annuel premium pour ministères, pays et grandes institutions.	annuel	5000000	FCFA	\N	\N	\N	{"api": true, "ia_avancee": true, "multi_pays": true, "multi_sites": true, "statistiques_avancees": true, "supervision_nationale": true, "intelligence_economique": true, "accompagnement_prioritaire": true}	actif	2026-06-12 13:40:46.539346	2026-06-12 13:40:46.539346
\.


--
-- Data for Name: plans_emploi_premium; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plans_emploi_premium (id, code, nom, prix, devise, duree_jours, avantages, created_at) FROM stdin;
4a0a6f3f-5723-4771-91b4-bed892fbb59a	premium_candidat_plus	Premium Candidat Plus	10000	FCFA	30	{"type": "candidat_plus"}	2026-06-02 19:50:51.542657
587f721c-fbd3-4a15-b040-d227f7f4c605	premium_recruteur	Premium Recruteur	15000	FCFA	30	{"type": "recruteur"}	2026-06-02 19:50:51.542657
d7945790-f26a-4e10-adff-43c57ffda8f9	gratuit_candidat	Gratuit Candidat	0	FCFA	30	{}	2026-06-02 19:50:51.542657
7d3c251d-1f51-4d2f-88b5-f840b112cfb3	express_particulier	Express Particulier	\N	FCFA	1	{"type": "express"}	2026-06-02 19:50:51.542657
5e2d6e7f-b544-4fe3-9618-c957a4767ffe	premium_candidat	Premium Candidat	5000	FCFA	30	{"type": "candidat"}	2026-06-02 19:50:51.542657
\.


--
-- Data for Name: plans_intelligence_economique; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plans_intelligence_economique (id, code, nom, prix, devise, duree_jours, description, avantages, statut, created_at) FROM stdin;
2cf83e09-fdb4-4e4b-b891-4110dea72a6c	ie_mensuel	Intelligence Économique Mensuel	5000	FCFA	30	Accès mensuel aux opportunités économiques, emplois, stages, concours, formations, financements et recommandations.	{"ia": "recommandations", "alertes": "instantanees", "recherche": "illimitee"}	actif	2026-06-12 10:10:26.845777
37920e70-ff94-4dda-bda9-01d29df8b40e	ie_annuel	Intelligence Économique Annuel	17000	FCFA	365	Accès annuel aux opportunités économiques, emplois, stages, concours, formations, financements et recommandations.	{"ia": "recommandations", "alertes": "instantanees", "priorite": "oui", "recherche": "illimitee"}	actif	2026-06-12 10:10:26.845777
\.


--
-- Data for Name: plans_intervention_personnalises; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plans_intervention_personnalises (id, jeune_id, plan_titre, objectif_global, horizon, statut, resume, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: plans_mentorat_psychoeduc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plans_mentorat_psychoeduc (id, code, nom, duree_jours, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: plans_reseau_opportunites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plans_reseau_opportunites (id, code, nom, prix, devise, duree_jours, avantages, statut, created_at) FROM stdin;
a98a332d-ebb8-4f76-b368-a75276d80f1c	reseau_gratuit	Réseau Gratuit	0	FCFA	30	{"profil": "visible_limite", "services": "1"}	actif	2026-06-12 10:25:07.436564
5b8c3e80-d5ff-49f0-bf4b-e57927d99533	reseau_pro	Réseau Pro	10000	FCFA	30	{"profil": "visible", "services": "illimites", "mise_en_avant": "oui"}	actif	2026-06-12 10:25:07.436564
2ff7263d-0151-46b4-856d-a469671cbf97	reseau_premium	Réseau Premium	25000	FCFA	30	{"badge": "expert_verifie", "profil": "prioritaire", "services": "illimites", "statistiques": "oui"}	actif	2026-06-12 10:25:07.436564
\.


--
-- Data for Name: preuves_competences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.preuves_competences (id, competence_eleve_id, type_fichier, fichier_url, nom_fichier, description, commentaire_eleve, statut, created_at) FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, nom, email, role, user_id, organisation_id, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: profils; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profils (id, nom, prenom, telephone, photo, email, actif, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: profils_intelligence_economique; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profils_intelligence_economique (id, user_id, eleve_independant_id, eleve_formateur_id, jeune_id, nom_complet, telephone, whatsapp, email, type_profil, metiers_recherches, competences, formations_recherchees, secteurs_interet, ville, commune, pays, disponible, premium, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: profils_recherche_emploi; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profils_recherche_emploi (id, jeune_id, user_id, nom_complet, photo_url, metier_recherche, competences, experience, niveau_etude, disponibilite, commune, ville, pays, salaire_souhaite, cv_url, visible, premium, created_at, updated_at, metier_libre, formation_libre, competence_libre, secteur_libre, metier_ref_id, formation_ref_id, competence_ref_id, secteur_ref_id, metier_choix_source, formation_choix_source, competence_choix_source, secteur_choix_source) FROM stdin;
\.


--
-- Data for Name: profils_reseau_opportunites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profils_reseau_opportunites (id, user_id, organisation_id, nom_complet, photo_url, type_profil, titre_professionnel, secteur, metier, ville, commune, pays, description, experience_annees, telephone, whatsapp, email, note_moyenne, nombre_accompagnements, nombre_mises_relation, taux_reussite, statut, premium, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: programmes_suivi; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.programmes_suivi (id, organisation_id, nom, type_programme, objectif_general, duree_jours, statut, created_at, updated_at, metier_libre, formation_libre, competence_libre, secteur_libre, metier_ref_id, formation_ref_id, competence_ref_id, secteur_ref_id, metier_choix_source, formation_choix_source, competence_choix_source, secteur_choix_source) FROM stdin;
\.


--
-- Data for Name: projet_de_vie; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projet_de_vie (id, jeune_id, vision, objectifs, plan_action, suivi, date_creation) FROM stdin;
\.


--
-- Data for Name: projets_financement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projets_financement (id, beneficiaire_id, titre, description, montant_demande, montant_collecte, statut, commission_plateforme, created_at) FROM stdin;
\.


--
-- Data for Name: quotas_organisations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quotas_organisations (id, organisation_id, max_utilisateurs, max_beneficiaires, max_stockage_bytes, used_utilisateurs, used_beneficiaires, used_stockage_bytes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: rapports_suivi_eleves_formateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rapports_suivi_eleves_formateurs (id, suivi_id, eleve_formateur_id, formateur_id, jeune_id, objectif_id, titre, format, fichier_url, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: recherches_intelligence_economique; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recherches_intelligence_economique (id, user_id, type_recherche, mot_cle, categorie, ville, commune, pays, premium, created_at) FROM stdin;
\.


--
-- Data for Name: recherches_travailleurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recherches_travailleurs (id, recruteur_id, metier, competences, commune, ville, experience_min, disponibilite, paiement_statut, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: recommandations_educatives; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recommandations_educatives (id, jeune_id, source, recommandation, priorite, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: recommandations_ia_psychoeduc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recommandations_ia_psychoeduc (id, eleve_id, type_eleve, categorie, titre, recommandation, priorite, statut, created_at) FROM stdin;
\.


--
-- Data for Name: recommandations_intelligence_economique; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recommandations_intelligence_economique (id, user_id, profil_ie_id, opportunite_id, type_recommandation, titre, contenu, score_pertinence, priorite, source, statut, created_at) FROM stdin;
\.


--
-- Data for Name: referentiel_metiers_formations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.referentiel_metiers_formations (id, type_element, nom, categorie, sous_categorie, description, pays, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: reservations_formateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reservations_formateurs (id, formateur_id, service_id, nom_client, type_client, telephone, whatsapp, message, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: resultats_reseau_opportunites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.resultats_reseau_opportunites (id, demande_id, resultat, type_resultat, succes, commentaire, created_at) FROM stdin;
\.


--
-- Data for Name: risques_predictifs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.risques_predictifs (id, jeune_id, score_risque, type_risque, modele, periode, explication, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: roles_utilisateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles_utilisateurs (id, user_id, role, organisation_id, statut, created_at, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: sante_bien_etre; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sante_bien_etre (id, jeune_id, situation_sante, habitudes_de_vie, besoins_soutien, recommandation, date_creation) FROM stdin;
\.


--
-- Data for Name: scores_iga; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.scores_iga (id, beneficiaire_id, score, periode, annee, mois, commentaire, created_at) FROM stdin;
\.


--
-- Data for Name: services_formateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.services_formateurs (id, formateur_id, titre, type_service, description, prix, devise, duree, lieu, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: services_reseau_opportunites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.services_reseau_opportunites (id, profil_reseau_id, titre, type_service, description, secteur, metier, prix, devise, duree, conditions, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sessions_connexion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions_connexion (id, organisation_id, user_id, token, ip_address, user_agent, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: soutiens_jeune; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.soutiens_jeune (id, jeune_id, source_type, source_id, relation, contribution_type, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stages_apprentissages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stages_apprentissages (id, jeune_id, employeur_id, type_placement, titre, domaine, date_debut, date_fin, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: structures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.structures (id, nom, type_structure, responsable, telephone, email, adresse, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: structures_abc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.structures_abc (id, nom, type_structure, responsable_nom, responsable_prenom, telephone, whatsapp, email, pays, ville, commune, quartier, adresse, description, nombre_eleves, nombre_formateurs, nombre_educateurs, statut, date_creation, date_validation, created_by, valide_par) FROM stdin;
\.


--
-- Data for Name: suggestions_referentiel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suggestions_referentiel (id, type_element, valeur_suggeree, categorie_suggeree, table_source, champ_source, utilisateur_id, statut, created_at) FROM stdin;
\.


--
-- Data for Name: suivis_eleves_formateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suivis_eleves_formateurs (id, eleve_formateur_id, formateur_id, jeune_id, objectif_id, type_suivi, date_suivi, resume, evaluation, observations, progression, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: suivis_mentorat_psychoeduc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suivis_mentorat_psychoeduc (id, eleve_id, mentor_id, statut, type_suivi, date_suivi, resume, observations, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: suivis_post_insertion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suivis_post_insertion (id, jeune_id, type_suivi, date_cible, date_effective, resultat, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: suivis_programmes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suivis_programmes (id, inscription_programme_id, etape_id, responsable_id, titre, observation, statut, date_prevue, date_realisation, created_at, updated_at, metier_libre, formation_libre, competence_libre, secteur_libre, metier_ref_id, formation_ref_id, competence_ref_id, secteur_ref_id, metier_choix_source, formation_choix_source, competence_choix_source, secteur_choix_source) FROM stdin;
\.


--
-- Data for Name: super_admins; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.super_admins (id, user_id, nom_complet, email, statut, created_at) FROM stdin;
\.


--
-- Data for Name: taches_ia_psychoeduc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.taches_ia_psychoeduc (id, agent_id, user_id, eleve_id, type_eleve, demande, contexte, resultat, statut, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: transactions_paiement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions_paiement (id, user_id, abonnement_id, fournisseur_code, montant, devise, reference_interne, reference_externe, statut, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: transactions_wallet; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions_wallet (id, wallet_id, organisation_id, amount, direction, reference, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: utilisateurs_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.utilisateurs_roles (id, user_id, role, created_at) FROM stdin;
\.


--
-- Data for Name: validations_competences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.validations_competences (id, competence_eleve_id, preuve_id, validateur_id, type_validateur, decision, note, commentaire_validation, recommandations, created_at) FROM stdin;
\.


--
-- Data for Name: validations_suivi_independant; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.validations_suivi_independant (id, eleve_id, valide_par_user_id, statut, note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: wallet_fondateur; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallet_fondateur (id, organisation_id, solde_fond, solde_total, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: webhooks_paiement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.webhooks_paiement (id, fournisseur_code, reference_externe, payload, statut_traitement, created_at) FROM stdin;
\.


--
-- Name: abonnements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.abonnements_id_seq', 1, false);


--
-- Name: affectations_beneficiaires_personnel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.affectations_beneficiaires_personnel_id_seq', 1, false);


--
-- Name: agents_ia_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.agents_ia_id_seq', 5, true);


--
-- Name: beneficiaires_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.beneficiaires_id_seq', 1, false);


--
-- Name: codes_promo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.codes_promo_id_seq', 1, true);


--
-- Name: commissions_plateforme_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.commissions_plateforme_id_seq', 1, false);


--
-- Name: contributions_financement_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contributions_financement_id_seq', 1, false);


--
-- Name: documents_beneficiaires_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.documents_beneficiaires_id_seq', 1, false);


--
-- Name: dossiers_beneficiaires_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dossiers_beneficiaires_id_seq', 1, false);


--
-- Name: eleves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.eleves_id_seq', 8, true);


--
-- Name: insertions_sociopro_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.insertions_sociopro_id_seq', 1, false);


--
-- Name: mentors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mentors_id_seq', 1, false);


--
-- Name: paiements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.paiements_id_seq', 1, false);


--
-- Name: parents_tuteurs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.parents_tuteurs_id_seq', 1, false);


--
-- Name: personnel_structures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.personnel_structures_id_seq', 1, false);


--
-- Name: projets_financement_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.projets_financement_id_seq', 1, false);


--
-- Name: scores_iga_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.scores_iga_id_seq', 1, false);


--
-- Name: structures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.structures_id_seq', 1, false);


--
-- Name: abonnements_clients_abc abonnements_clients_abc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_clients_abc
    ADD CONSTRAINT abonnements_clients_abc_pkey PRIMARY KEY (id);


--
-- Name: abonnements_emploi_premium abonnements_emploi_premium_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_emploi_premium
    ADD CONSTRAINT abonnements_emploi_premium_pkey PRIMARY KEY (id);


--
-- Name: abonnements_formateurs abonnements_formateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_formateurs
    ADD CONSTRAINT abonnements_formateurs_pkey PRIMARY KEY (id);


--
-- Name: abonnements_intelligence_economique abonnements_intelligence_economique_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_intelligence_economique
    ADD CONSTRAINT abonnements_intelligence_economique_pkey PRIMARY KEY (id);


--
-- Name: abonnements_mentorat_psychoeduc abonnements_mentorat_psychoeduc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_mentorat_psychoeduc
    ADD CONSTRAINT abonnements_mentorat_psychoeduc_pkey PRIMARY KEY (id);


--
-- Name: abonnements abonnements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements
    ADD CONSTRAINT abonnements_pkey PRIMARY KEY (id);


--
-- Name: abonnements_reseau_opportunites abonnements_reseau_opportunites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_reseau_opportunites
    ADD CONSTRAINT abonnements_reseau_opportunites_pkey PRIMARY KEY (id);


--
-- Name: activites activites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activites
    ADD CONSTRAINT activites_pkey PRIMARY KEY (id);


--
-- Name: affectations_beneficiaires_personnel affectations_beneficiaires_personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affectations_beneficiaires_personnel
    ADD CONSTRAINT affectations_beneficiaires_personnel_pkey PRIMARY KEY (id);


--
-- Name: affectations_mentors_psychoeduc affectations_mentors_psychoeduc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affectations_mentors_psychoeduc
    ADD CONSTRAINT affectations_mentors_psychoeduc_pkey PRIMARY KEY (id);


--
-- Name: affectations_personnel affectations_personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affectations_personnel
    ADD CONSTRAINT affectations_personnel_pkey PRIMARY KEY (id);


--
-- Name: agents_ia agents_ia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents_ia
    ADD CONSTRAINT agents_ia_pkey PRIMARY KEY (id);


--
-- Name: agents_ia_psychoeduc agents_ia_psychoeduc_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents_ia_psychoeduc
    ADD CONSTRAINT agents_ia_psychoeduc_code_key UNIQUE (code);


--
-- Name: agents_ia_psychoeduc agents_ia_psychoeduc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents_ia_psychoeduc
    ADD CONSTRAINT agents_ia_psychoeduc_pkey PRIMARY KEY (id);


--
-- Name: alertes_emploi alertes_emploi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertes_emploi
    ADD CONSTRAINT alertes_emploi_pkey PRIMARY KEY (id);


--
-- Name: alertes_intelligence_economique alertes_intelligence_economique_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertes_intelligence_economique
    ADD CONSTRAINT alertes_intelligence_economique_pkey PRIMARY KEY (id);


--
-- Name: alertes_suivi_independant alertes_suivi_independant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertes_suivi_independant
    ADD CONSTRAINT alertes_suivi_independant_pkey PRIMARY KEY (id);


--
-- Name: anciens_beneficiaires anciens_beneficiaires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anciens_beneficiaires
    ADD CONSTRAINT anciens_beneficiaires_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: avis_formateurs avis_formateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avis_formateurs
    ADD CONSTRAINT avis_formateurs_pkey PRIMARY KEY (id);


--
-- Name: avis_reseau_opportunites avis_reseau_opportunites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avis_reseau_opportunites
    ADD CONSTRAINT avis_reseau_opportunites_pkey PRIMARY KEY (id);


--
-- Name: badges_eleves badges_eleves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges_eleves
    ADD CONSTRAINT badges_eleves_pkey PRIMARY KEY (id);


--
-- Name: beneficiaires beneficiaires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaires
    ADD CONSTRAINT beneficiaires_pkey PRIMARY KEY (id);


--
-- Name: campagnes_soutien campagnes_soutien_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campagnes_soutien
    ADD CONSTRAINT campagnes_soutien_pkey PRIMARY KEY (id);


--
-- Name: candidatures candidatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidatures
    ADD CONSTRAINT candidatures_pkey PRIMARY KEY (id);


--
-- Name: capital_social capital_social_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_social
    ADD CONSTRAINT capital_social_pkey PRIMARY KEY (id);


--
-- Name: citoyennete_leadership citoyennete_leadership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citoyennete_leadership
    ADD CONSTRAINT citoyennete_leadership_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: codes_promo codes_promo_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codes_promo
    ADD CONSTRAINT codes_promo_code_key UNIQUE (code);


--
-- Name: codes_promo codes_promo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codes_promo
    ADD CONSTRAINT codes_promo_pkey PRIMARY KEY (id);


--
-- Name: commissions_plateforme commissions_plateforme_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions_plateforme
    ADD CONSTRAINT commissions_plateforme_pkey PRIMARY KEY (id);


--
-- Name: competences_eleves competences_eleves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competences_eleves
    ADD CONSTRAINT competences_eleves_pkey PRIMARY KEY (id);


--
-- Name: competences competences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competences
    ADD CONSTRAINT competences_pkey PRIMARY KEY (id);


--
-- Name: composants_dashboard composants_dashboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composants_dashboard
    ADD CONSTRAINT composants_dashboard_pkey PRIMARY KEY (id);


--
-- Name: concours_etat concours_etat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concours_etat
    ADD CONSTRAINT concours_etat_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: contributions_financement contributions_financement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contributions_financement
    ADD CONSTRAINT contributions_financement_pkey PRIMARY KEY (id);


--
-- Name: deblocages_contacts deblocages_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deblocages_contacts
    ADD CONSTRAINT deblocages_contacts_pkey PRIMARY KEY (id);


--
-- Name: demandes_acces_abc demandes_acces_abc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_acces_abc
    ADD CONSTRAINT demandes_acces_abc_pkey PRIMARY KEY (id);


--
-- Name: demandes_assistance_suivi demandes_assistance_suivi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_assistance_suivi
    ADD CONSTRAINT demandes_assistance_suivi_pkey PRIMARY KEY (id);


--
-- Name: demandes_creation_niveaux_abc demandes_creation_niveaux_abc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_creation_niveaux_abc
    ADD CONSTRAINT demandes_creation_niveaux_abc_pkey PRIMARY KEY (id);


--
-- Name: demandes_reseau_opportunites demandes_reseau_opportunites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_reseau_opportunites
    ADD CONSTRAINT demandes_reseau_opportunites_pkey PRIMARY KEY (id);


--
-- Name: details_employeurs details_employeurs_organisation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.details_employeurs
    ADD CONSTRAINT details_employeurs_organisation_id_key UNIQUE (organisation_id);


--
-- Name: details_employeurs details_employeurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.details_employeurs
    ADD CONSTRAINT details_employeurs_pkey PRIMARY KEY (id);


--
-- Name: details_ministeres details_ministeres_organisation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.details_ministeres
    ADD CONSTRAINT details_ministeres_organisation_id_key UNIQUE (organisation_id);


--
-- Name: details_ministeres details_ministeres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.details_ministeres
    ADD CONSTRAINT details_ministeres_pkey PRIMARY KEY (id);


--
-- Name: details_structures details_structures_organisation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.details_structures
    ADD CONSTRAINT details_structures_organisation_id_key UNIQUE (organisation_id);


--
-- Name: details_structures details_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.details_structures
    ADD CONSTRAINT details_structures_pkey PRIMARY KEY (id);


--
-- Name: documents_beneficiaires documents_beneficiaires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents_beneficiaires
    ADD CONSTRAINT documents_beneficiaires_pkey PRIMARY KEY (id);


--
-- Name: donateurs donateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donateurs
    ADD CONSTRAINT donateurs_pkey PRIMARY KEY (id);


--
-- Name: dons_soutiens dons_soutiens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dons_soutiens
    ADD CONSTRAINT dons_soutiens_pkey PRIMARY KEY (id);


--
-- Name: dossiers_beneficiaires dossiers_beneficiaires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dossiers_beneficiaires
    ADD CONSTRAINT dossiers_beneficiaires_pkey PRIMARY KEY (id);


--
-- Name: eleves_formateurs eleves_formateurs_jeune_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eleves_formateurs
    ADD CONSTRAINT eleves_formateurs_jeune_uniq UNIQUE (formateur_id, jeune_id);


--
-- Name: eleves_formateurs eleves_formateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eleves_formateurs
    ADD CONSTRAINT eleves_formateurs_pkey PRIMARY KEY (id);


--
-- Name: eleves_independants eleves_independants_eleve_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eleves_independants
    ADD CONSTRAINT eleves_independants_eleve_source_id_key UNIQUE (eleve_source_id);


--
-- Name: eleves_independants eleves_independants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eleves_independants
    ADD CONSTRAINT eleves_independants_pkey PRIMARY KEY (id);


--
-- Name: eleves eleves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eleves
    ADD CONSTRAINT eleves_pkey PRIMARY KEY (id);


--
-- Name: employeurs employeurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employeurs
    ADD CONSTRAINT employeurs_pkey PRIMARY KEY (id);


--
-- Name: entretiens entretiens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entretiens
    ADD CONSTRAINT entretiens_pkey PRIMARY KEY (id);


--
-- Name: essais_gratuits essais_gratuits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essais_gratuits
    ADD CONSTRAINT essais_gratuits_pkey PRIMARY KEY (id);


--
-- Name: etapes_plans_intervention etapes_plans_intervention_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etapes_plans_intervention
    ADD CONSTRAINT etapes_plans_intervention_pkey PRIMARY KEY (id);


--
-- Name: etapes_programmes etapes_programmes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etapes_programmes
    ADD CONSTRAINT etapes_programmes_pkey PRIMARY KEY (id);


--
-- Name: formateurs formateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formateurs
    ADD CONSTRAINT formateurs_pkey PRIMARY KEY (id);


--
-- Name: formations_catalogue formations_catalogue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formations_catalogue
    ADD CONSTRAINT formations_catalogue_pkey PRIMARY KEY (id);


--
-- Name: formations formations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formations
    ADD CONSTRAINT formations_pkey PRIMARY KEY (id);


--
-- Name: fournisseurs_paiement fournisseurs_paiement_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fournisseurs_paiement
    ADD CONSTRAINT fournisseurs_paiement_code_key UNIQUE (code);


--
-- Name: fournisseurs_paiement fournisseurs_paiement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fournisseurs_paiement
    ADD CONSTRAINT fournisseurs_paiement_pkey PRIMARY KEY (id);


--
-- Name: garants_suivi garants_suivi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garants_suivi
    ADD CONSTRAINT garants_suivi_pkey PRIMARY KEY (id);


--
-- Name: historique_validations_abc historique_validations_abc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_validations_abc
    ADD CONSTRAINT historique_validations_abc_pkey PRIMARY KEY (id);


--
-- Name: iga_scores iga_scores_jeune_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iga_scores
    ADD CONSTRAINT iga_scores_jeune_id_key UNIQUE (jeune_id);


--
-- Name: iga_scores iga_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iga_scores
    ADD CONSTRAINT iga_scores_pkey PRIMARY KEY (id);


--
-- Name: implantations implantations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implantations
    ADD CONSTRAINT implantations_pkey PRIMARY KEY (id);


--
-- Name: incidents_disciplinaires incidents_disciplinaires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents_disciplinaires
    ADD CONSTRAINT incidents_disciplinaires_pkey PRIMARY KEY (id);


--
-- Name: inscriptions_activites inscriptions_activites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscriptions_activites
    ADD CONSTRAINT inscriptions_activites_pkey PRIMARY KEY (id);


--
-- Name: inscriptions_formations inscriptions_formations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscriptions_formations
    ADD CONSTRAINT inscriptions_formations_pkey PRIMARY KEY (id);


--
-- Name: inscriptions_programmes inscriptions_programmes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscriptions_programmes
    ADD CONSTRAINT inscriptions_programmes_pkey PRIMARY KEY (id);


--
-- Name: insertion_sociopro insertion_sociopro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insertion_sociopro
    ADD CONSTRAINT insertion_sociopro_pkey PRIMARY KEY (id);


--
-- Name: insertions_sociopro insertions_sociopro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insertions_sociopro
    ADD CONSTRAINT insertions_sociopro_pkey PRIMARY KEY (id);


--
-- Name: instances_saas_pays instances_saas_pays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instances_saas_pays
    ADD CONSTRAINT instances_saas_pays_pkey PRIMARY KEY (id);


--
-- Name: intelligence_economique intelligence_economique_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_economique
    ADD CONSTRAINT intelligence_economique_pkey PRIMARY KEY (id);


--
-- Name: invitations_abc invitations_abc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations_abc
    ADD CONSTRAINT invitations_abc_pkey PRIMARY KEY (id);


--
-- Name: invitations_abc invitations_abc_token_invitation_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations_abc
    ADD CONSTRAINT invitations_abc_token_invitation_key UNIQUE (token_invitation);


--
-- Name: invitations_utilisateurs invitations_utilisateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations_utilisateurs
    ADD CONSTRAINT invitations_utilisateurs_pkey PRIMARY KEY (id);


--
-- Name: invitations_utilisateurs invitations_utilisateurs_token_invitation_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations_utilisateurs
    ADD CONSTRAINT invitations_utilisateurs_token_invitation_key UNIQUE (token_invitation);


--
-- Name: jeunes jeunes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jeunes
    ADD CONSTRAINT jeunes_pkey PRIMARY KEY (id);


--
-- Name: licences licences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licences
    ADD CONSTRAINT licences_pkey PRIMARY KEY (id);


--
-- Name: logs_acces_donnees logs_acces_donnees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_acces_donnees
    ADD CONSTRAINT logs_acces_donnees_pkey PRIMARY KEY (id);


--
-- Name: membres_organisations membres_organisations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membres_organisations
    ADD CONSTRAINT membres_organisations_pkey PRIMARY KEY (id);


--
-- Name: mentors mentors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentors
    ADD CONSTRAINT mentors_pkey PRIMARY KEY (id);


--
-- Name: mentors_psychoeduc mentors_psychoeduc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentors_psychoeduc
    ADD CONSTRAINT mentors_psychoeduc_pkey PRIMARY KEY (id);


--
-- Name: modules_actives modules_actives_organisation_id_module_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules_actives
    ADD CONSTRAINT modules_actives_organisation_id_module_key UNIQUE (organisation_id, module);


--
-- Name: modules_actives modules_actives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules_actives
    ADD CONSTRAINT modules_actives_pkey PRIMARY KEY (id);


--
-- Name: niveaux_abc niveaux_abc_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.niveaux_abc
    ADD CONSTRAINT niveaux_abc_code_key UNIQUE (code);


--
-- Name: niveaux_abc niveaux_abc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.niveaux_abc
    ADD CONSTRAINT niveaux_abc_pkey PRIMARY KEY (id);


--
-- Name: objectifs_beneficiaires objectifs_beneficiaires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectifs_beneficiaires
    ADD CONSTRAINT objectifs_beneficiaires_pkey PRIMARY KEY (id);


--
-- Name: objectifs_eleves_formateurs objectifs_eleves_formateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectifs_eleves_formateurs
    ADD CONSTRAINT objectifs_eleves_formateurs_pkey PRIMARY KEY (id);


--
-- Name: offres_emploi offres_emploi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offres_emploi
    ADD CONSTRAINT offres_emploi_pkey PRIMARY KEY (id);


--
-- Name: opportunites_economiques opportunites_economiques_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunites_economiques
    ADD CONSTRAINT opportunites_economiques_pkey PRIMARY KEY (id);


--
-- Name: organisations organisations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisations
    ADD CONSTRAINT organisations_pkey PRIMARY KEY (id);


--
-- Name: pages_interface pages_interface_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages_interface
    ADD CONSTRAINT pages_interface_code_key UNIQUE (code);


--
-- Name: pages_interface pages_interface_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages_interface
    ADD CONSTRAINT pages_interface_pkey PRIMARY KEY (id);


--
-- Name: paiements_abonnements_abc paiements_abonnements_abc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements_abonnements_abc
    ADD CONSTRAINT paiements_abonnements_abc_pkey PRIMARY KEY (id);


--
-- Name: paiements_intelligence_economique paiements_intelligence_economique_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements_intelligence_economique
    ADD CONSTRAINT paiements_intelligence_economique_pkey PRIMARY KEY (id);


--
-- Name: paiements paiements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements
    ADD CONSTRAINT paiements_pkey PRIMARY KEY (id);


--
-- Name: parents_tuteurs parents_tuteurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents_tuteurs
    ADD CONSTRAINT parents_tuteurs_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: personnel_structures personnel_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_structures
    ADD CONSTRAINT personnel_structures_pkey PRIMARY KEY (id);


--
-- Name: pieces_demandes_abc pieces_demandes_abc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pieces_demandes_abc
    ADD CONSTRAINT pieces_demandes_abc_pkey PRIMARY KEY (id);


--
-- Name: pieces_identite_inscriptions pieces_identite_inscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pieces_identite_inscriptions
    ADD CONSTRAINT pieces_identite_inscriptions_pkey PRIMARY KEY (id);


--
-- Name: plans_abonnement_abc plans_abonnement_abc_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_abonnement_abc
    ADD CONSTRAINT plans_abonnement_abc_code_key UNIQUE (code);


--
-- Name: plans_abonnement_abc plans_abonnement_abc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_abonnement_abc
    ADD CONSTRAINT plans_abonnement_abc_pkey PRIMARY KEY (id);


--
-- Name: plans_emploi_premium plans_emploi_premium_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_emploi_premium
    ADD CONSTRAINT plans_emploi_premium_pkey PRIMARY KEY (id);


--
-- Name: plans_intelligence_economique plans_intelligence_economique_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_intelligence_economique
    ADD CONSTRAINT plans_intelligence_economique_code_key UNIQUE (code);


--
-- Name: plans_intelligence_economique plans_intelligence_economique_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_intelligence_economique
    ADD CONSTRAINT plans_intelligence_economique_pkey PRIMARY KEY (id);


--
-- Name: plans_intervention_personnalises plans_intervention_personnalises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_intervention_personnalises
    ADD CONSTRAINT plans_intervention_personnalises_pkey PRIMARY KEY (id);


--
-- Name: plans_mentorat_psychoeduc plans_mentorat_psychoeduc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_mentorat_psychoeduc
    ADD CONSTRAINT plans_mentorat_psychoeduc_pkey PRIMARY KEY (id);


--
-- Name: plans_reseau_opportunites plans_reseau_opportunites_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_reseau_opportunites
    ADD CONSTRAINT plans_reseau_opportunites_code_key UNIQUE (code);


--
-- Name: plans_reseau_opportunites plans_reseau_opportunites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_reseau_opportunites
    ADD CONSTRAINT plans_reseau_opportunites_pkey PRIMARY KEY (id);


--
-- Name: preuves_competences preuves_competences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preuves_competences
    ADD CONSTRAINT preuves_competences_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profils_intelligence_economique profils_intelligence_economique_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils_intelligence_economique
    ADD CONSTRAINT profils_intelligence_economique_pkey PRIMARY KEY (id);


--
-- Name: profils profils_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils
    ADD CONSTRAINT profils_pkey PRIMARY KEY (id);


--
-- Name: profils_recherche_emploi profils_recherche_emploi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils_recherche_emploi
    ADD CONSTRAINT profils_recherche_emploi_pkey PRIMARY KEY (id);


--
-- Name: profils_reseau_opportunites profils_reseau_opportunites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils_reseau_opportunites
    ADD CONSTRAINT profils_reseau_opportunites_pkey PRIMARY KEY (id);


--
-- Name: programmes_suivi programmes_suivi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programmes_suivi
    ADD CONSTRAINT programmes_suivi_pkey PRIMARY KEY (id);


--
-- Name: projet_de_vie projet_de_vie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projet_de_vie
    ADD CONSTRAINT projet_de_vie_pkey PRIMARY KEY (id);


--
-- Name: projets_financement projets_financement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets_financement
    ADD CONSTRAINT projets_financement_pkey PRIMARY KEY (id);


--
-- Name: quotas_organisations quotas_organisations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotas_organisations
    ADD CONSTRAINT quotas_organisations_pkey PRIMARY KEY (id);


--
-- Name: rapports_suivi_eleves_formateurs rapports_suivi_eleves_formateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rapports_suivi_eleves_formateurs
    ADD CONSTRAINT rapports_suivi_eleves_formateurs_pkey PRIMARY KEY (id);


--
-- Name: recherches_intelligence_economique recherches_intelligence_economique_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recherches_intelligence_economique
    ADD CONSTRAINT recherches_intelligence_economique_pkey PRIMARY KEY (id);


--
-- Name: recherches_travailleurs recherches_travailleurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recherches_travailleurs
    ADD CONSTRAINT recherches_travailleurs_pkey PRIMARY KEY (id);


--
-- Name: recommandations_educatives recommandations_educatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommandations_educatives
    ADD CONSTRAINT recommandations_educatives_pkey PRIMARY KEY (id);


--
-- Name: recommandations_ia_psychoeduc recommandations_ia_psychoeduc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommandations_ia_psychoeduc
    ADD CONSTRAINT recommandations_ia_psychoeduc_pkey PRIMARY KEY (id);


--
-- Name: recommandations_intelligence_economique recommandations_intelligence_economique_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommandations_intelligence_economique
    ADD CONSTRAINT recommandations_intelligence_economique_pkey PRIMARY KEY (id);


--
-- Name: referentiel_metiers_formations referentiel_metiers_formations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referentiel_metiers_formations
    ADD CONSTRAINT referentiel_metiers_formations_pkey PRIMARY KEY (id);


--
-- Name: reservations_formateurs reservations_formateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations_formateurs
    ADD CONSTRAINT reservations_formateurs_pkey PRIMARY KEY (id);


--
-- Name: resultats_reseau_opportunites resultats_reseau_opportunites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultats_reseau_opportunites
    ADD CONSTRAINT resultats_reseau_opportunites_pkey PRIMARY KEY (id);


--
-- Name: risques_predictifs risques_predictifs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risques_predictifs
    ADD CONSTRAINT risques_predictifs_pkey PRIMARY KEY (id);


--
-- Name: roles_utilisateurs roles_utilisateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_utilisateurs
    ADD CONSTRAINT roles_utilisateurs_pkey PRIMARY KEY (id);


--
-- Name: sante_bien_etre sante_bien_etre_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sante_bien_etre
    ADD CONSTRAINT sante_bien_etre_pkey PRIMARY KEY (id);


--
-- Name: scores_iga scores_iga_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scores_iga
    ADD CONSTRAINT scores_iga_pkey PRIMARY KEY (id);


--
-- Name: services_formateurs services_formateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services_formateurs
    ADD CONSTRAINT services_formateurs_pkey PRIMARY KEY (id);


--
-- Name: services_reseau_opportunites services_reseau_opportunites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services_reseau_opportunites
    ADD CONSTRAINT services_reseau_opportunites_pkey PRIMARY KEY (id);


--
-- Name: sessions_connexion sessions_connexion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_connexion
    ADD CONSTRAINT sessions_connexion_pkey PRIMARY KEY (id);


--
-- Name: sessions_connexion sessions_connexion_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_connexion
    ADD CONSTRAINT sessions_connexion_token_key UNIQUE (token);


--
-- Name: soutiens_jeune soutiens_jeune_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soutiens_jeune
    ADD CONSTRAINT soutiens_jeune_pkey PRIMARY KEY (id);


--
-- Name: stages_apprentissages stages_apprentissages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages_apprentissages
    ADD CONSTRAINT stages_apprentissages_pkey PRIMARY KEY (id);


--
-- Name: structures_abc structures_abc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structures_abc
    ADD CONSTRAINT structures_abc_pkey PRIMARY KEY (id);


--
-- Name: structures structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structures
    ADD CONSTRAINT structures_pkey PRIMARY KEY (id);


--
-- Name: suggestions_referentiel suggestions_referentiel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions_referentiel
    ADD CONSTRAINT suggestions_referentiel_pkey PRIMARY KEY (id);


--
-- Name: suivis_eleves_formateurs suivis_eleves_formateurs_objectif_fk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis_eleves_formateurs
    ADD CONSTRAINT suivis_eleves_formateurs_objectif_fk UNIQUE (id, objectif_id);


--
-- Name: suivis_eleves_formateurs suivis_eleves_formateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis_eleves_formateurs
    ADD CONSTRAINT suivis_eleves_formateurs_pkey PRIMARY KEY (id);


--
-- Name: suivis_mentorat_psychoeduc suivis_mentorat_psychoeduc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis_mentorat_psychoeduc
    ADD CONSTRAINT suivis_mentorat_psychoeduc_pkey PRIMARY KEY (id);


--
-- Name: suivis_post_insertion suivis_post_insertion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis_post_insertion
    ADD CONSTRAINT suivis_post_insertion_pkey PRIMARY KEY (id);


--
-- Name: suivis_programmes suivis_programmes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis_programmes
    ADD CONSTRAINT suivis_programmes_pkey PRIMARY KEY (id);


--
-- Name: super_admins super_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_pkey PRIMARY KEY (id);


--
-- Name: taches_ia_psychoeduc taches_ia_psychoeduc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taches_ia_psychoeduc
    ADD CONSTRAINT taches_ia_psychoeduc_pkey PRIMARY KEY (id);


--
-- Name: transactions_paiement transactions_paiement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions_paiement
    ADD CONSTRAINT transactions_paiement_pkey PRIMARY KEY (id);


--
-- Name: transactions_paiement transactions_paiement_reference_interne_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions_paiement
    ADD CONSTRAINT transactions_paiement_reference_interne_key UNIQUE (reference_interne);


--
-- Name: transactions_wallet transactions_wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions_wallet
    ADD CONSTRAINT transactions_wallet_pkey PRIMARY KEY (id);


--
-- Name: utilisateurs_roles utilisateurs_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs_roles
    ADD CONSTRAINT utilisateurs_roles_pkey PRIMARY KEY (id);


--
-- Name: validations_competences validations_competences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validations_competences
    ADD CONSTRAINT validations_competences_pkey PRIMARY KEY (id);


--
-- Name: validations_suivi_independant validations_suivi_independant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validations_suivi_independant
    ADD CONSTRAINT validations_suivi_independant_pkey PRIMARY KEY (id);


--
-- Name: wallet_fondateur wallet_fondateur_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_fondateur
    ADD CONSTRAINT wallet_fondateur_pkey PRIMARY KEY (id);


--
-- Name: webhooks_paiement webhooks_paiement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks_paiement
    ADD CONSTRAINT webhooks_paiement_pkey PRIMARY KEY (id);


--
-- Name: abonnements_emploi_premium_plan_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX abonnements_emploi_premium_plan_id_idx ON public.abonnements_emploi_premium USING btree (plan_id);


--
-- Name: abonnements_emploi_premium_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX abonnements_emploi_premium_user_id_idx ON public.abonnements_emploi_premium USING btree (user_id);


--
-- Name: abonnements_formateurs_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX abonnements_formateurs_formateur_id_idx ON public.abonnements_formateurs USING btree (formateur_id);


--
-- Name: activites_date_debut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activites_date_debut_idx ON public.activites USING btree (date_debut);


--
-- Name: activites_date_fin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activites_date_fin_idx ON public.activites USING btree (date_fin);


--
-- Name: activites_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activites_statut_idx ON public.activites USING btree (statut);


--
-- Name: activites_type_activite_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activites_type_activite_idx ON public.activites USING btree (type_activite);


--
-- Name: affectations_personnel_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affectations_personnel_org_idx ON public.affectations_personnel USING btree (organisation_id);


--
-- Name: affectations_personnel_personnel_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affectations_personnel_personnel_idx ON public.affectations_personnel USING btree (personnel_structures_id);


--
-- Name: alertes_emploi_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alertes_emploi_created_at_idx ON public.alertes_emploi USING btree (created_at);


--
-- Name: alertes_emploi_metier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alertes_emploi_metier_idx ON public.alertes_emploi USING btree (metier);


--
-- Name: alertes_emploi_organisation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alertes_emploi_organisation_id_idx ON public.alertes_emploi USING btree (organisation_id);


--
-- Name: alertes_emploi_premium_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alertes_emploi_premium_idx ON public.alertes_emploi USING btree (premium);


--
-- Name: alertes_emploi_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alertes_emploi_statut_idx ON public.alertes_emploi USING btree (statut);


--
-- Name: alertes_emploi_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alertes_emploi_user_id_idx ON public.alertes_emploi USING btree (user_id);


--
-- Name: alertes_emploi_ville_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alertes_emploi_ville_idx ON public.alertes_emploi USING btree (ville);


--
-- Name: anciens_beneficiaires_annee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX anciens_beneficiaires_annee_idx ON public.anciens_beneficiaires USING btree (annee);


--
-- Name: anciens_beneficiaires_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX anciens_beneficiaires_jeune_id_idx ON public.anciens_beneficiaires USING btree (jeune_id);


--
-- Name: avis_formateurs_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX avis_formateurs_formateur_id_idx ON public.avis_formateurs USING btree (formateur_id);


--
-- Name: campagnes_soutien_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campagnes_soutien_created_at_idx ON public.campagnes_soutien USING btree (created_at);


--
-- Name: campagnes_soutien_date_fin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campagnes_soutien_date_fin_idx ON public.campagnes_soutien USING btree (date_fin);


--
-- Name: campagnes_soutien_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campagnes_soutien_statut_idx ON public.campagnes_soutien USING btree (statut);


--
-- Name: capital_social_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX capital_social_jeune_id_idx ON public.capital_social USING btree (jeune_id);


--
-- Name: citoyennete_leadership_date_creation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX citoyennete_leadership_date_creation_idx ON public.citoyennete_leadership USING btree (date_creation);


--
-- Name: citoyennete_leadership_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX citoyennete_leadership_jeune_id_idx ON public.citoyennete_leadership USING btree (jeune_id);


--
-- Name: concours_etat_pays_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX concours_etat_pays_idx ON public.concours_etat USING btree (pays);


--
-- Name: contacts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_created_at_idx ON public.contacts USING btree (created_at);


--
-- Name: contacts_employeur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_employeur_id_idx ON public.contacts USING btree (employeur_id);


--
-- Name: contacts_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_jeune_id_idx ON public.contacts USING btree (jeune_id);


--
-- Name: contacts_niveau_importance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_niveau_importance_idx ON public.contacts USING btree (niveau_importance);


--
-- Name: contacts_type_contact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_type_contact_idx ON public.contacts USING btree (type_contact);


--
-- Name: debloquages_contacts_profil_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX debloquages_contacts_profil_id_idx ON public.deblocages_contacts USING btree (profil_id);


--
-- Name: debloquages_contacts_utilisateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX debloquages_contacts_utilisateur_id_idx ON public.deblocages_contacts USING btree (utilisateur_id);


--
-- Name: demandes_assistance_suivi_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX demandes_assistance_suivi_created_at_idx ON public.demandes_assistance_suivi USING btree (created_at);


--
-- Name: demandes_assistance_suivi_eleve_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX demandes_assistance_suivi_eleve_idx ON public.demandes_assistance_suivi USING btree (eleve_formateur_id);


--
-- Name: demandes_assistance_suivi_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX demandes_assistance_suivi_formateur_id_idx ON public.demandes_assistance_suivi USING btree (formateur_id);


--
-- Name: demandes_assistance_suivi_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX demandes_assistance_suivi_jeune_id_idx ON public.demandes_assistance_suivi USING btree (jeune_id);


--
-- Name: demandes_assistance_suivi_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX demandes_assistance_suivi_statut_idx ON public.demandes_assistance_suivi USING btree (statut);


--
-- Name: donateurs_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donateurs_email_idx ON public.donateurs USING btree (email);


--
-- Name: donateurs_type_donateur_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX donateurs_type_donateur_idx ON public.donateurs USING btree (type_donateur);


--
-- Name: dons_soutiens_beneficiaire_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dons_soutiens_beneficiaire_jeune_id_idx ON public.dons_soutiens USING btree (beneficiaire_jeune_id);


--
-- Name: dons_soutiens_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dons_soutiens_created_at_idx ON public.dons_soutiens USING btree (created_at);


--
-- Name: dons_soutiens_date_reception_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dons_soutiens_date_reception_idx ON public.dons_soutiens USING btree (date_reception);


--
-- Name: dons_soutiens_donateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dons_soutiens_donateur_id_idx ON public.dons_soutiens USING btree (donateur_id);


--
-- Name: dons_soutiens_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dons_soutiens_statut_idx ON public.dons_soutiens USING btree (statut);


--
-- Name: eleves_formateurs_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eleves_formateurs_formateur_id_idx ON public.eleves_formateurs USING btree (formateur_id);


--
-- Name: eleves_formateurs_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eleves_formateurs_jeune_id_idx ON public.eleves_formateurs USING btree (jeune_id);


--
-- Name: eleves_formateurs_ville_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eleves_formateurs_ville_idx ON public.eleves_formateurs USING btree (ville);


--
-- Name: employeurs_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employeurs_jeune_id_idx ON public.employeurs USING btree (jeune_id);


--
-- Name: employeurs_nom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employeurs_nom_idx ON public.employeurs USING btree (nom);


--
-- Name: entretiens_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entretiens_date_idx ON public.entretiens USING btree (date_entretien);


--
-- Name: entretiens_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entretiens_jeune_id_idx ON public.entretiens USING btree (jeune_id);


--
-- Name: etapes_plans_intervention_plan_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX etapes_plans_intervention_plan_id_idx ON public.etapes_plans_intervention USING btree (plan_id);


--
-- Name: etapes_plans_intervention_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX etapes_plans_intervention_statut_idx ON public.etapes_plans_intervention USING btree (statut);


--
-- Name: formateurs_abonnement_marketplace_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_abonnement_marketplace_idx ON public.formateurs USING btree (abonnement_marketplace);


--
-- Name: formateurs_assistance_psychoeduc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_assistance_psychoeduc_idx ON public.formateurs USING btree (assistance_psychoeduc);


--
-- Name: formateurs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_created_at_idx ON public.formateurs USING btree (created_at);


--
-- Name: formateurs_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_formateur_id_idx ON public.formateurs USING btree (id);


--
-- Name: formateurs_mode_suivi_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_mode_suivi_idx ON public.formateurs USING btree (mode_suivi);


--
-- Name: formateurs_nombre_eleves_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_nombre_eleves_idx ON public.formateurs USING btree (nombre_eleves);


--
-- Name: formateurs_nombre_suivis_realises_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_nombre_suivis_realises_idx ON public.formateurs USING btree (nombre_suivis_realises);


--
-- Name: formateurs_note_moyenne_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_note_moyenne_idx ON public.formateurs USING btree (note_moyenne);


--
-- Name: formateurs_organisation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_organisation_id_idx ON public.formateurs USING btree (organisation_id);


--
-- Name: formateurs_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_statut_idx ON public.formateurs USING btree (statut);


--
-- Name: formateurs_taux_reussite_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_taux_reussite_idx ON public.formateurs USING btree (taux_reussite);


--
-- Name: formateurs_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_user_id_idx ON public.formateurs USING btree (user_id);


--
-- Name: formateurs_ville_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formateurs_ville_idx ON public.formateurs USING btree (ville);


--
-- Name: formations_catalogue_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formations_catalogue_formateur_id_idx ON public.formations_catalogue USING btree (formateur_id);


--
-- Name: idx_abonnements_clients_abc_organisation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abonnements_clients_abc_organisation ON public.abonnements_clients_abc USING btree (organisation_id);


--
-- Name: idx_abonnements_clients_abc_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abonnements_clients_abc_plan ON public.abonnements_clients_abc USING btree (plan_id);


--
-- Name: idx_abonnements_clients_abc_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abonnements_clients_abc_statut ON public.abonnements_clients_abc USING btree (statut);


--
-- Name: idx_abonnements_clients_abc_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abonnements_clients_abc_user ON public.abonnements_clients_abc USING btree (user_id);


--
-- Name: idx_abonnements_ie_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abonnements_ie_user ON public.abonnements_intelligence_economique USING btree (user_id);


--
-- Name: idx_abonnements_mentorat_psychoeduc_eleve; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abonnements_mentorat_psychoeduc_eleve ON public.abonnements_mentorat_psychoeduc USING btree (eleve_id, statut);


--
-- Name: idx_affectations_beneficiaire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affectations_beneficiaire ON public.affectations_beneficiaires_personnel USING btree (beneficiaire_id);


--
-- Name: idx_affectations_mentors_psychoeduc_eleve; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affectations_mentors_psychoeduc_eleve ON public.affectations_mentors_psychoeduc USING btree (eleve_id, statut);


--
-- Name: idx_affectations_personnel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affectations_personnel ON public.affectations_beneficiaires_personnel USING btree (personnel_structures_id);


--
-- Name: idx_affectations_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affectations_statut ON public.affectations_beneficiaires_personnel USING btree (statut);


--
-- Name: idx_alertes_ie_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alertes_ie_user ON public.alertes_intelligence_economique USING btree (user_id);


--
-- Name: idx_alertes_suivi_independant_eleve; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alertes_suivi_independant_eleve ON public.alertes_suivi_independant USING btree (eleve_id);


--
-- Name: idx_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_org ON public.audit_logs USING btree (organisation_id);


--
-- Name: idx_audit_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_table ON public.audit_logs USING btree (table_name);


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_avis_reseau_profil; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_avis_reseau_profil ON public.avis_reseau_opportunites USING btree (profil_reseau_id);


--
-- Name: idx_badges_eleves_eleve; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_badges_eleves_eleve ON public.badges_eleves USING btree (eleve_id);


--
-- Name: idx_competence_eleve; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competence_eleve ON public.competences_eleves USING btree (competence_id);


--
-- Name: idx_demandes_abc_niveau; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandes_abc_niveau ON public.demandes_creation_niveaux_abc USING btree (niveau_code);


--
-- Name: idx_demandes_abc_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandes_abc_statut ON public.demandes_creation_niveaux_abc USING btree (statut);


--
-- Name: idx_demandes_abc_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandes_abc_user ON public.demandes_creation_niveaux_abc USING btree (user_id);


--
-- Name: idx_demandes_acces_abc_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandes_acces_abc_mode ON public.demandes_acces_abc USING btree (mode_creation);


--
-- Name: idx_demandes_acces_abc_niveau; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandes_acces_abc_niveau ON public.demandes_acces_abc USING btree (niveau_code);


--
-- Name: idx_demandes_acces_abc_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandes_acces_abc_statut ON public.demandes_acces_abc USING btree (statut);


--
-- Name: idx_demandes_acces_abc_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandes_acces_abc_user ON public.demandes_acces_abc USING btree (user_id);


--
-- Name: idx_demandes_reseau_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandes_reseau_service ON public.demandes_reseau_opportunites USING btree (service_id);


--
-- Name: idx_demandes_reseau_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandes_reseau_statut ON public.demandes_reseau_opportunites USING btree (statut);


--
-- Name: idx_details_employeurs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_details_employeurs_org ON public.details_employeurs USING btree (organisation_id);


--
-- Name: idx_details_ministeres_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_details_ministeres_org ON public.details_ministeres USING btree (organisation_id);


--
-- Name: idx_details_structures_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_details_structures_org ON public.details_structures USING btree (organisation_id);


--
-- Name: idx_essais_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_essais_org ON public.essais_gratuits USING btree (organisation_id);


--
-- Name: idx_garants_suivi_autorise; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garants_suivi_autorise ON public.garants_suivi USING btree (eleve_id) WHERE (autorise_suivi = true);


--
-- Name: idx_garants_suivi_eleve_actif; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_garants_suivi_eleve_actif ON public.garants_suivi USING btree (eleve_id, statut) WHERE (statut = 'actif'::text);


--
-- Name: idx_historique_validations_abc_demande; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historique_validations_abc_demande ON public.historique_validations_abc USING btree (demande_id);


--
-- Name: idx_implantations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_implantations_org ON public.implantations USING btree (organisation_id);


--
-- Name: idx_invitations_abc_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_abc_token ON public.invitations_abc USING btree (token_invitation);


--
-- Name: idx_licences_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licences_org ON public.licences USING btree (organisation_id);


--
-- Name: idx_licences_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licences_statut ON public.licences USING btree (statut);


--
-- Name: idx_membres_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_membres_org ON public.membres_organisations USING btree (organisation_id);


--
-- Name: idx_membres_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_membres_user ON public.membres_organisations USING btree (user_id);


--
-- Name: idx_modules_actives_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_modules_actives_module ON public.modules_actives USING btree (module);


--
-- Name: idx_modules_actives_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_modules_actives_org ON public.modules_actives USING btree (organisation_id);


--
-- Name: idx_opportunites_categorie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunites_categorie ON public.opportunites_economiques USING btree (categorie);


--
-- Name: idx_opportunites_metier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunites_metier ON public.opportunites_economiques USING btree (metier);


--
-- Name: idx_opportunites_premium; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunites_premium ON public.opportunites_economiques USING btree (premium);


--
-- Name: idx_opportunites_ville; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunites_ville ON public.opportunites_economiques USING btree (ville);


--
-- Name: idx_paiements_abonnements_abc_abonnement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_paiements_abonnements_abc_abonnement ON public.paiements_abonnements_abc USING btree (abonnement_id);


--
-- Name: idx_paiements_abonnements_abc_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_paiements_abonnements_abc_statut ON public.paiements_abonnements_abc USING btree (statut);


--
-- Name: idx_paiements_ie_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_paiements_ie_user ON public.paiements_intelligence_economique USING btree (user_id);


--
-- Name: idx_permissions_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_module ON public.permissions USING btree (module);


--
-- Name: idx_permissions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_org ON public.permissions USING btree (organisation_id);


--
-- Name: idx_permissions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_role ON public.permissions USING btree (role_utilisateur_id);


--
-- Name: idx_pieces_demandes_abc_demande; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pieces_demandes_abc_demande ON public.pieces_demandes_abc USING btree (demande_id);


--
-- Name: idx_pieces_identite_eleve_formateur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pieces_identite_eleve_formateur ON public.pieces_identite_inscriptions USING btree (eleve_formateur_id);


--
-- Name: idx_pieces_identite_eleve_independant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pieces_identite_eleve_independant ON public.pieces_identite_inscriptions USING btree (eleve_independant_id);


--
-- Name: idx_pieces_identite_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pieces_identite_statut ON public.pieces_identite_inscriptions USING btree (statut_verification);


--
-- Name: idx_pieces_identite_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pieces_identite_user_id ON public.pieces_identite_inscriptions USING btree (user_id);


--
-- Name: idx_plans_abonnement_abc_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_abonnement_abc_code ON public.plans_abonnement_abc USING btree (code);


--
-- Name: idx_plans_abonnement_abc_niveau; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_abonnement_abc_niveau ON public.plans_abonnement_abc USING btree (niveau_code);


--
-- Name: idx_preuve_competence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_preuve_competence ON public.preuves_competences USING btree (competence_eleve_id);


--
-- Name: idx_profils_ie_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profils_ie_user ON public.profils_intelligence_economique USING btree (user_id);


--
-- Name: idx_profils_reseau_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profils_reseau_statut ON public.profils_reseau_opportunites USING btree (statut);


--
-- Name: idx_profils_reseau_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profils_reseau_type ON public.profils_reseau_opportunites USING btree (type_profil);


--
-- Name: idx_profils_reseau_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profils_reseau_user ON public.profils_reseau_opportunites USING btree (user_id);


--
-- Name: idx_profils_reseau_ville; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profils_reseau_ville ON public.profils_reseau_opportunites USING btree (ville);


--
-- Name: idx_quotas_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotas_org ON public.quotas_organisations USING btree (organisation_id);


--
-- Name: idx_services_reseau_profil; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_reseau_profil ON public.services_reseau_opportunites USING btree (profil_reseau_id);


--
-- Name: idx_services_reseau_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_reseau_type ON public.services_reseau_opportunites USING btree (type_service);


--
-- Name: idx_suivis_mentorat_psychoeduc_eleve; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suivis_mentorat_psychoeduc_eleve ON public.suivis_mentorat_psychoeduc USING btree (eleve_id);


--
-- Name: idx_tx_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tx_org ON public.transactions_wallet USING btree (organisation_id);


--
-- Name: idx_tx_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tx_wallet ON public.transactions_wallet USING btree (wallet_id);


--
-- Name: idx_validation_competence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_validation_competence ON public.validations_competences USING btree (competence_eleve_id);


--
-- Name: idx_validations_suivi_independant_eleve; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_validations_suivi_independant_eleve ON public.validations_suivi_independant USING btree (eleve_id);


--
-- Name: idx_wallet_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_org ON public.wallet_fondateur USING btree (organisation_id);


--
-- Name: iga_scores_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX iga_scores_jeune_id_idx ON public.iga_scores USING btree (jeune_id);


--
-- Name: incidents_disciplinaires_date_incident_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_disciplinaires_date_incident_idx ON public.incidents_disciplinaires USING btree (date_incident);


--
-- Name: incidents_disciplinaires_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_disciplinaires_jeune_id_idx ON public.incidents_disciplinaires USING btree (jeune_id);


--
-- Name: incidents_disciplinaires_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_disciplinaires_statut_idx ON public.incidents_disciplinaires USING btree (statut);


--
-- Name: inscriptions_activites_activite_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_activites_activite_id_idx ON public.inscriptions_activites USING btree (activite_id);


--
-- Name: inscriptions_activites_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_activites_created_at_idx ON public.inscriptions_activites USING btree (created_at);


--
-- Name: inscriptions_activites_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_activites_jeune_id_idx ON public.inscriptions_activites USING btree (jeune_id);


--
-- Name: inscriptions_activites_paiement_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_activites_paiement_statut_idx ON public.inscriptions_activites USING btree (paiement_statut);


--
-- Name: inscriptions_activites_statut_inscription_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_activites_statut_inscription_idx ON public.inscriptions_activites USING btree (statut_inscription);


--
-- Name: inscriptions_formations_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_formations_formateur_id_idx ON public.inscriptions_formations USING btree (formateur_id);


--
-- Name: inscriptions_formations_formation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_formations_formation_id_idx ON public.inscriptions_formations USING btree (formation_id);


--
-- Name: inscriptions_programmes_contact_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_programmes_contact_id_idx ON public.inscriptions_programmes USING btree (contact_id);


--
-- Name: inscriptions_programmes_date_debut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_programmes_date_debut_idx ON public.inscriptions_programmes USING btree (date_debut);


--
-- Name: inscriptions_programmes_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_programmes_jeune_id_idx ON public.inscriptions_programmes USING btree (jeune_id);


--
-- Name: inscriptions_programmes_programme_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_programmes_programme_id_idx ON public.inscriptions_programmes USING btree (programme_id);


--
-- Name: inscriptions_programmes_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscriptions_programmes_statut_idx ON public.inscriptions_programmes USING btree (statut);


--
-- Name: insertion_sociopro_date_debut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insertion_sociopro_date_debut_idx ON public.insertion_sociopro USING btree (date_debut);


--
-- Name: insertion_sociopro_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insertion_sociopro_jeune_id_idx ON public.insertion_sociopro USING btree (jeune_id);


--
-- Name: intelligence_economique_date_creation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intelligence_economique_date_creation_idx ON public.intelligence_economique USING btree (date_creation);


--
-- Name: intelligence_economique_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intelligence_economique_jeune_id_idx ON public.intelligence_economique USING btree (jeune_id);


--
-- Name: invitations_utilisateurs_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitations_utilisateurs_org_id_idx ON public.invitations_utilisateurs USING btree (organisation_id);


--
-- Name: invitations_utilisateurs_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitations_utilisateurs_token_idx ON public.invitations_utilisateurs USING btree (token_invitation);


--
-- Name: jeunes_date_creation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jeunes_date_creation_idx ON public.jeunes USING btree (date_creation);


--
-- Name: jeunes_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jeunes_statut_idx ON public.jeunes USING btree (statut);


--
-- Name: logs_acces_donnees_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX logs_acces_donnees_created_at_idx ON public.logs_acces_donnees USING btree (created_at DESC);


--
-- Name: logs_acces_donnees_organisation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX logs_acces_donnees_organisation_id_idx ON public.logs_acces_donnees USING btree (organisation_id);


--
-- Name: logs_acces_donnees_super_admin_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX logs_acces_donnees_super_admin_id_idx ON public.logs_acces_donnees USING btree (super_admin_id);


--
-- Name: objectifs_eleves_formateurs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX objectifs_eleves_formateurs_created_at_idx ON public.objectifs_eleves_formateurs USING btree (created_at);


--
-- Name: objectifs_eleves_formateurs_eleve_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX objectifs_eleves_formateurs_eleve_idx ON public.objectifs_eleves_formateurs USING btree (eleve_formateur_id);


--
-- Name: objectifs_eleves_formateurs_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX objectifs_eleves_formateurs_formateur_id_idx ON public.objectifs_eleves_formateurs USING btree (formateur_id);


--
-- Name: objectifs_eleves_formateurs_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX objectifs_eleves_formateurs_jeune_id_idx ON public.objectifs_eleves_formateurs USING btree (jeune_id);


--
-- Name: objectifs_eleves_formateurs_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX objectifs_eleves_formateurs_statut_idx ON public.objectifs_eleves_formateurs USING btree (statut);


--
-- Name: offres_emploi_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offres_emploi_created_at_idx ON public.offres_emploi USING btree (created_at);


--
-- Name: offres_emploi_employeur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offres_emploi_employeur_id_idx ON public.offres_emploi USING btree (employeur_id);


--
-- Name: offres_emploi_metier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offres_emploi_metier_idx ON public.offres_emploi USING btree (metier);


--
-- Name: offres_emploi_organisation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offres_emploi_organisation_id_idx ON public.offres_emploi USING btree (organisation_id);


--
-- Name: offres_emploi_premium_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offres_emploi_premium_idx ON public.offres_emploi USING btree (premium);


--
-- Name: offres_emploi_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offres_emploi_statut_idx ON public.offres_emploi USING btree (statut);


--
-- Name: offres_emploi_ville_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offres_emploi_ville_idx ON public.offres_emploi USING btree (ville);


--
-- Name: plans_intervention_personnalises_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plans_intervention_personnalises_jeune_id_idx ON public.plans_intervention_personnalises USING btree (jeune_id);


--
-- Name: plans_intervention_personnalises_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plans_intervention_personnalises_statut_idx ON public.plans_intervention_personnalises USING btree (statut);


--
-- Name: profils_recherche_emploi_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profils_recherche_emploi_jeune_id_idx ON public.profils_recherche_emploi USING btree (jeune_id);


--
-- Name: profils_recherche_emploi_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profils_recherche_emploi_user_id_idx ON public.profils_recherche_emploi USING btree (user_id);


--
-- Name: programmes_suivi_organisation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX programmes_suivi_organisation_id_idx ON public.programmes_suivi USING btree (organisation_id);


--
-- Name: projet_de_vie_date_creation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projet_de_vie_date_creation_idx ON public.projet_de_vie USING btree (date_creation);


--
-- Name: projet_de_vie_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projet_de_vie_jeune_id_idx ON public.projet_de_vie USING btree (jeune_id);


--
-- Name: rapports_suivi_eleves_formateurs_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rapports_suivi_eleves_formateurs_formateur_id_idx ON public.rapports_suivi_eleves_formateurs USING btree (formateur_id);


--
-- Name: rapports_suivi_eleves_formateurs_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rapports_suivi_eleves_formateurs_jeune_id_idx ON public.rapports_suivi_eleves_formateurs USING btree (jeune_id);


--
-- Name: rapports_suivi_eleves_formateurs_objectif_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rapports_suivi_eleves_formateurs_objectif_id_idx ON public.rapports_suivi_eleves_formateurs USING btree (objectif_id);


--
-- Name: rapports_suivi_eleves_formateurs_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rapports_suivi_eleves_formateurs_statut_idx ON public.rapports_suivi_eleves_formateurs USING btree (statut);


--
-- Name: rapports_suivi_eleves_formateurs_suivi_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rapports_suivi_eleves_formateurs_suivi_id_idx ON public.rapports_suivi_eleves_formateurs USING btree (suivi_id);


--
-- Name: recherches_travailleurs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recherches_travailleurs_created_at_idx ON public.recherches_travailleurs USING btree (created_at);


--
-- Name: recherches_travailleurs_metier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recherches_travailleurs_metier_idx ON public.recherches_travailleurs USING btree (metier);


--
-- Name: recherches_travailleurs_paiement_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recherches_travailleurs_paiement_statut_idx ON public.recherches_travailleurs USING btree (paiement_statut);


--
-- Name: recherches_travailleurs_recruteur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recherches_travailleurs_recruteur_id_idx ON public.recherches_travailleurs USING btree (recruteur_id);


--
-- Name: recherches_travailleurs_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recherches_travailleurs_statut_idx ON public.recherches_travailleurs USING btree (statut);


--
-- Name: recherches_travailleurs_ville_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recherches_travailleurs_ville_idx ON public.recherches_travailleurs USING btree (ville);


--
-- Name: recommandations_educatives_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommandations_educatives_jeune_id_idx ON public.recommandations_educatives USING btree (jeune_id);


--
-- Name: recommandations_educatives_priorite_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommandations_educatives_priorite_idx ON public.recommandations_educatives USING btree (priorite);


--
-- Name: recommandations_educatives_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommandations_educatives_statut_idx ON public.recommandations_educatives USING btree (statut);


--
-- Name: referentiel_metiers_formations_categorie_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referentiel_metiers_formations_categorie_idx ON public.referentiel_metiers_formations USING btree (categorie);


--
-- Name: referentiel_metiers_formations_nom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referentiel_metiers_formations_nom_idx ON public.referentiel_metiers_formations USING btree (nom);


--
-- Name: referentiel_metiers_formations_pays_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referentiel_metiers_formations_pays_idx ON public.referentiel_metiers_formations USING btree (pays);


--
-- Name: referentiel_metiers_formations_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referentiel_metiers_formations_statut_idx ON public.referentiel_metiers_formations USING btree (statut);


--
-- Name: referentiel_metiers_formations_type_element_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referentiel_metiers_formations_type_element_idx ON public.referentiel_metiers_formations USING btree (type_element);


--
-- Name: reservations_formateurs_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reservations_formateurs_formateur_id_idx ON public.reservations_formateurs USING btree (formateur_id);


--
-- Name: reservations_formateurs_service_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reservations_formateurs_service_id_idx ON public.reservations_formateurs USING btree (service_id);


--
-- Name: risques_predictifs_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX risques_predictifs_jeune_id_idx ON public.risques_predictifs USING btree (jeune_id);


--
-- Name: risques_predictifs_periode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX risques_predictifs_periode_idx ON public.risques_predictifs USING btree (periode);


--
-- Name: risques_predictifs_score_risque_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX risques_predictifs_score_risque_idx ON public.risques_predictifs USING btree (score_risque);


--
-- Name: risques_predictifs_type_risque_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX risques_predictifs_type_risque_idx ON public.risques_predictifs USING btree (type_risque);


--
-- Name: sante_bien_etre_date_creation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sante_bien_etre_date_creation_idx ON public.sante_bien_etre USING btree (date_creation);


--
-- Name: sante_bien_etre_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sante_bien_etre_jeune_id_idx ON public.sante_bien_etre USING btree (jeune_id);


--
-- Name: services_formateurs_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_formateurs_formateur_id_idx ON public.services_formateurs USING btree (formateur_id);


--
-- Name: sessions_connexion_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_connexion_org_idx ON public.sessions_connexion USING btree (organisation_id);


--
-- Name: sessions_connexion_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_connexion_user_idx ON public.sessions_connexion USING btree (user_id);


--
-- Name: soutiens_jeune_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX soutiens_jeune_jeune_id_idx ON public.soutiens_jeune USING btree (jeune_id);


--
-- Name: soutiens_jeune_source_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX soutiens_jeune_source_type_idx ON public.soutiens_jeune USING btree (source_type);


--
-- Name: stages_apprentissages_employeur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stages_apprentissages_employeur_id_idx ON public.stages_apprentissages USING btree (employeur_id);


--
-- Name: stages_apprentissages_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stages_apprentissages_jeune_id_idx ON public.stages_apprentissages USING btree (jeune_id);


--
-- Name: stages_apprentissages_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stages_apprentissages_statut_idx ON public.stages_apprentissages USING btree (statut);


--
-- Name: suggestions_referentiel_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggestions_referentiel_statut_idx ON public.suggestions_referentiel USING btree (statut);


--
-- Name: suggestions_referentiel_table_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggestions_referentiel_table_source_idx ON public.suggestions_referentiel USING btree (table_source);


--
-- Name: suggestions_referentiel_type_element_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggestions_referentiel_type_element_idx ON public.suggestions_referentiel USING btree (type_element);


--
-- Name: suggestions_referentiel_valeur_suggeree_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggestions_referentiel_valeur_suggeree_idx ON public.suggestions_referentiel USING btree (valeur_suggeree);


--
-- Name: suivis_eleves_formateurs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suivis_eleves_formateurs_created_at_idx ON public.suivis_eleves_formateurs USING btree (created_at);


--
-- Name: suivis_eleves_formateurs_date_suivi_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suivis_eleves_formateurs_date_suivi_idx ON public.suivis_eleves_formateurs USING btree (date_suivi);


--
-- Name: suivis_eleves_formateurs_eleve_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suivis_eleves_formateurs_eleve_idx ON public.suivis_eleves_formateurs USING btree (eleve_formateur_id);


--
-- Name: suivis_eleves_formateurs_formateur_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suivis_eleves_formateurs_formateur_id_idx ON public.suivis_eleves_formateurs USING btree (formateur_id);


--
-- Name: suivis_eleves_formateurs_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suivis_eleves_formateurs_jeune_id_idx ON public.suivis_eleves_formateurs USING btree (jeune_id);


--
-- Name: suivis_eleves_formateurs_objectif_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suivis_eleves_formateurs_objectif_id_idx ON public.suivis_eleves_formateurs USING btree (objectif_id);


--
-- Name: suivis_eleves_formateurs_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suivis_eleves_formateurs_statut_idx ON public.suivis_eleves_formateurs USING btree (statut);


--
-- Name: suivis_post_insertion_jeune_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suivis_post_insertion_jeune_id_idx ON public.suivis_post_insertion USING btree (jeune_id);


--
-- Name: suivis_post_insertion_statut_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suivis_post_insertion_statut_idx ON public.suivis_post_insertion USING btree (statut);


--
-- Name: suivis_post_insertion_type_suivi_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suivis_post_insertion_type_suivi_idx ON public.suivis_post_insertion USING btree (type_suivi);


--
-- Name: suivis_programmes_date_prevue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suivis_programmes_date_prevue_idx ON public.suivis_programmes USING btree (date_prevue);


--
-- Name: super_admins_user_id_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX super_admins_user_id_unique_idx ON public.super_admins USING btree (user_id);


--
-- Name: abonnements_formateurs abonnements_formateurs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER abonnements_formateurs_set_updated_at BEFORE UPDATE ON public.abonnements_formateurs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: documents_beneficiaires audit_documents_beneficiaires_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_documents_beneficiaires_changes AFTER INSERT OR DELETE OR UPDATE ON public.documents_beneficiaires FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: dossiers_beneficiaires audit_dossiers_beneficiaires_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_dossiers_beneficiaires_changes AFTER INSERT OR DELETE OR UPDATE ON public.dossiers_beneficiaires FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: mentors audit_mentors_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_mentors_changes AFTER INSERT OR DELETE OR UPDATE ON public.mentors FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: parents_tuteurs audit_parents_tuteurs_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_parents_tuteurs_changes AFTER INSERT OR DELETE OR UPDATE ON public.parents_tuteurs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: formateurs formateurs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER formateurs_set_updated_at BEFORE UPDATE ON public.formateurs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: formations_catalogue formations_catalogue_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER formations_catalogue_set_updated_at BEFORE UPDATE ON public.formations_catalogue FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inscriptions_formations inscriptions_formations_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inscriptions_formations_set_updated_at BEFORE UPDATE ON public.inscriptions_formations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inscriptions_programmes inscriptions_programmes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inscriptions_programmes_set_updated_at BEFORE UPDATE ON public.inscriptions_programmes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: objectifs_beneficiaires objectifs_beneficiaires_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER objectifs_beneficiaires_set_updated_at BEFORE UPDATE ON public.objectifs_beneficiaires FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: programmes_suivi programmes_suivi_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER programmes_suivi_set_updated_at BEFORE UPDATE ON public.programmes_suivi FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reservations_formateurs reservations_formateurs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reservations_formateurs_set_updated_at BEFORE UPDATE ON public.reservations_formateurs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: services_formateurs services_formateurs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER services_formateurs_set_updated_at BEFORE UPDATE ON public.services_formateurs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: documents_beneficiaires set_updated_at_documents_beneficiaires; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_documents_beneficiaires BEFORE UPDATE ON public.documents_beneficiaires FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: dossiers_beneficiaires set_updated_at_dossiers_beneficiaires; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_dossiers_beneficiaires BEFORE UPDATE ON public.dossiers_beneficiaires FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: mentors set_updated_at_mentors; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_mentors BEFORE UPDATE ON public.mentors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: parents_tuteurs set_updated_at_parents_tuteurs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_parents_tuteurs BEFORE UPDATE ON public.parents_tuteurs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: suivis_programmes suivis_programmes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER suivis_programmes_set_updated_at BEFORE UPDATE ON public.suivis_programmes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: activites trg_activites_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_activites_updated_at BEFORE UPDATE ON public.activites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: affectations_personnel trg_affectations_personnel_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_affectations_personnel_audit AFTER INSERT OR DELETE OR UPDATE ON public.affectations_personnel FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();


--
-- Name: affectations_personnel trg_affectations_personnel_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_affectations_personnel_updated_at BEFORE UPDATE ON public.affectations_personnel FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contacts trg_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inscriptions_activites trg_create_inscription_programme_from_activite; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_create_inscription_programme_from_activite AFTER INSERT ON public.inscriptions_activites FOR EACH ROW EXECUTE FUNCTION public.create_inscription_programme_from_activite();


--
-- Name: details_employeurs trg_details_employeurs_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_details_employeurs_audit AFTER INSERT OR DELETE OR UPDATE ON public.details_employeurs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: details_employeurs trg_details_employeurs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_details_employeurs_updated_at BEFORE UPDATE ON public.details_employeurs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: details_ministeres trg_details_ministeres_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_details_ministeres_audit AFTER INSERT OR DELETE OR UPDATE ON public.details_ministeres FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: details_ministeres trg_details_ministeres_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_details_ministeres_updated_at BEFORE UPDATE ON public.details_ministeres FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: details_structures trg_details_structures_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_details_structures_audit AFTER INSERT OR DELETE OR UPDATE ON public.details_structures FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: details_structures trg_details_structures_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_details_structures_updated_at BEFORE UPDATE ON public.details_structures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: essais_gratuits trg_essais_gratuits_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_essais_gratuits_audit AFTER INSERT OR DELETE OR UPDATE ON public.essais_gratuits FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: essais_gratuits trg_essais_gratuits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_essais_gratuits_updated_at BEFORE UPDATE ON public.essais_gratuits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: implantations trg_implantations_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_implantations_audit AFTER INSERT OR DELETE OR UPDATE ON public.implantations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: implantations trg_implantations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_implantations_updated_at BEFORE UPDATE ON public.implantations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: invitations_utilisateurs trg_invitations_utilisateurs_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invitations_utilisateurs_audit AFTER INSERT OR DELETE OR UPDATE ON public.invitations_utilisateurs FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();


--
-- Name: invitations_utilisateurs trg_invitations_utilisateurs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invitations_utilisateurs_updated_at BEFORE UPDATE ON public.invitations_utilisateurs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: licences trg_licences_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_licences_audit AFTER INSERT OR DELETE OR UPDATE ON public.licences FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: licences trg_licences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_licences_updated_at BEFORE UPDATE ON public.licences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: membres_organisations trg_membres_organisations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_membres_organisations_updated_at BEFORE UPDATE ON public.membres_organisations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: modules_actives trg_modules_actives_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_modules_actives_audit AFTER INSERT OR DELETE OR UPDATE ON public.modules_actives FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: modules_actives trg_modules_actives_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_modules_actives_updated_at BEFORE UPDATE ON public.modules_actives FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: organisations trg_organisations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_organisations_updated_at BEFORE UPDATE ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: permissions trg_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_permissions_updated_at BEFORE UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: personnel_structures trg_personnel_structures_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_personnel_structures_audit AFTER INSERT OR DELETE OR UPDATE ON public.personnel_structures FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();


--
-- Name: personnel_structures trg_personnel_structures_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_personnel_structures_updated_at BEFORE UPDATE ON public.personnel_structures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: quotas_organisations trg_quotas_organisations_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quotas_organisations_audit AFTER INSERT OR DELETE OR UPDATE ON public.quotas_organisations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: quotas_organisations trg_quotas_organisations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quotas_organisations_updated_at BEFORE UPDATE ON public.quotas_organisations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: roles_utilisateurs trg_roles_utilisateurs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_roles_utilisateurs_updated_at BEFORE UPDATE ON public.roles_utilisateurs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sessions_connexion trg_sessions_connexion_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sessions_connexion_audit AFTER INSERT OR DELETE OR UPDATE ON public.sessions_connexion FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();


--
-- Name: sessions_connexion trg_sessions_connexion_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sessions_connexion_updated_at BEFORE UPDATE ON public.sessions_connexion FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: transactions_wallet trg_transactions_wallet_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_transactions_wallet_audit AFTER INSERT OR DELETE OR UPDATE ON public.transactions_wallet FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: transactions_wallet trg_transactions_wallet_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_transactions_wallet_updated_at BEFORE UPDATE ON public.transactions_wallet FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: wallet_fondateur trg_wallet_fondateur_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wallet_fondateur_audit AFTER INSERT OR DELETE OR UPDATE ON public.wallet_fondateur FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: wallet_fondateur trg_wallet_fondateur_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wallet_fondateur_updated_at BEFORE UPDATE ON public.wallet_fondateur FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: abonnements_clients_abc abonnements_clients_abc_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_clients_abc
    ADD CONSTRAINT abonnements_clients_abc_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans_abonnement_abc(id) ON DELETE SET NULL;


--
-- Name: abonnements_emploi_premium abonnements_emploi_premium_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_emploi_premium
    ADD CONSTRAINT abonnements_emploi_premium_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans_emploi_premium(id);


--
-- Name: abonnements_intelligence_economique abonnements_intelligence_economique_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_intelligence_economique
    ADD CONSTRAINT abonnements_intelligence_economique_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans_intelligence_economique(id) ON DELETE SET NULL;


--
-- Name: abonnements_mentorat_psychoeduc abonnements_mentorat_psychoeduc_eleve_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_mentorat_psychoeduc
    ADD CONSTRAINT abonnements_mentorat_psychoeduc_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves_independants(id) ON DELETE CASCADE;


--
-- Name: abonnements_mentorat_psychoeduc abonnements_mentorat_psychoeduc_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_mentorat_psychoeduc
    ADD CONSTRAINT abonnements_mentorat_psychoeduc_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans_mentorat_psychoeduc(id) ON DELETE SET NULL;


--
-- Name: abonnements_reseau_opportunites abonnements_reseau_opportunites_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_reseau_opportunites
    ADD CONSTRAINT abonnements_reseau_opportunites_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans_reseau_opportunites(id) ON DELETE SET NULL;


--
-- Name: abonnements_reseau_opportunites abonnements_reseau_opportunites_profil_reseau_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abonnements_reseau_opportunites
    ADD CONSTRAINT abonnements_reseau_opportunites_profil_reseau_id_fkey FOREIGN KEY (profil_reseau_id) REFERENCES public.profils_reseau_opportunites(id) ON DELETE CASCADE;


--
-- Name: affectations_mentors_psychoeduc affectations_mentors_psychoeduc_eleve_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affectations_mentors_psychoeduc
    ADD CONSTRAINT affectations_mentors_psychoeduc_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves_independants(id) ON DELETE CASCADE;


--
-- Name: affectations_mentors_psychoeduc affectations_mentors_psychoeduc_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affectations_mentors_psychoeduc
    ADD CONSTRAINT affectations_mentors_psychoeduc_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.mentors_psychoeduc(id) ON DELETE CASCADE;


--
-- Name: affectations_personnel affectations_personnel_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affectations_personnel
    ADD CONSTRAINT affectations_personnel_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: affectations_personnel affectations_personnel_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affectations_personnel
    ADD CONSTRAINT affectations_personnel_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: affectations_personnel affectations_personnel_personnel_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affectations_personnel
    ADD CONSTRAINT affectations_personnel_personnel_fk FOREIGN KEY (personnel_structures_id) REFERENCES public.personnel_structures(id) ON DELETE CASCADE;


--
-- Name: affectations_personnel affectations_personnel_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affectations_personnel
    ADD CONSTRAINT affectations_personnel_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: alertes_emploi alertes_emploi_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertes_emploi
    ADD CONSTRAINT alertes_emploi_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id);


--
-- Name: alertes_intelligence_economique alertes_intelligence_economique_profil_ie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertes_intelligence_economique
    ADD CONSTRAINT alertes_intelligence_economique_profil_ie_id_fkey FOREIGN KEY (profil_ie_id) REFERENCES public.profils_intelligence_economique(id) ON DELETE CASCADE;


--
-- Name: alertes_suivi_independant alertes_suivi_independant_eleve_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertes_suivi_independant
    ADD CONSTRAINT alertes_suivi_independant_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves_independants(id) ON DELETE CASCADE;


--
-- Name: anciens_beneficiaires anciens_beneficiaires_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anciens_beneficiaires
    ADD CONSTRAINT anciens_beneficiaires_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE CASCADE;


--
-- Name: avis_reseau_opportunites avis_reseau_opportunites_profil_reseau_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avis_reseau_opportunites
    ADD CONSTRAINT avis_reseau_opportunites_profil_reseau_id_fkey FOREIGN KEY (profil_reseau_id) REFERENCES public.profils_reseau_opportunites(id) ON DELETE CASCADE;


--
-- Name: badges_eleves badges_eleves_eleve_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges_eleves
    ADD CONSTRAINT badges_eleves_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves_independants(id) ON DELETE CASCADE;


--
-- Name: beneficiaires beneficiaires_personnel_referent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaires
    ADD CONSTRAINT beneficiaires_personnel_referent_id_fkey FOREIGN KEY (personnel_referent_id) REFERENCES public.personnel_structures(id);


--
-- Name: beneficiaires beneficiaires_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaires
    ADD CONSTRAINT beneficiaires_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id);


--
-- Name: candidatures candidatures_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidatures
    ADD CONSTRAINT candidatures_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id);


--
-- Name: candidatures candidatures_offre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidatures
    ADD CONSTRAINT candidatures_offre_id_fkey FOREIGN KEY (offre_id) REFERENCES public.offres_emploi(id);


--
-- Name: candidatures candidatures_profil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidatures
    ADD CONSTRAINT candidatures_profil_id_fkey FOREIGN KEY (profil_id) REFERENCES public.profils_recherche_emploi(id);


--
-- Name: capital_social capital_social_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_social
    ADD CONSTRAINT capital_social_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE CASCADE;


--
-- Name: citoyennete_leadership citoyennete_leadership_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citoyennete_leadership
    ADD CONSTRAINT citoyennete_leadership_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE CASCADE;


--
-- Name: classes classes_formation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_formation_id_fkey FOREIGN KEY (formation_id) REFERENCES public.formations(id) ON DELETE CASCADE;


--
-- Name: competences_eleves competences_eleves_competence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competences_eleves
    ADD CONSTRAINT competences_eleves_competence_id_fkey FOREIGN KEY (competence_id) REFERENCES public.competences(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_employeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_employeur_id_fkey FOREIGN KEY (employeur_id) REFERENCES public.employeurs(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE SET NULL;


--
-- Name: contributions_financement contributions_financement_projet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contributions_financement
    ADD CONSTRAINT contributions_financement_projet_id_fkey FOREIGN KEY (projet_id) REFERENCES public.projets_financement(id) ON DELETE CASCADE;


--
-- Name: deblocages_contacts debloquages_contacts_profil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deblocages_contacts
    ADD CONSTRAINT debloquages_contacts_profil_id_fkey FOREIGN KEY (profil_id) REFERENCES public.profils_recherche_emploi(id);


--
-- Name: demandes_assistance_suivi demandes_assistance_suivi_eleve_formateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_assistance_suivi
    ADD CONSTRAINT demandes_assistance_suivi_eleve_formateur_id_fkey FOREIGN KEY (eleve_formateur_id) REFERENCES public.eleves_formateurs(id) ON DELETE SET NULL;


--
-- Name: demandes_assistance_suivi demandes_assistance_suivi_formateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_assistance_suivi
    ADD CONSTRAINT demandes_assistance_suivi_formateur_id_fkey FOREIGN KEY (formateur_id) REFERENCES public.formateurs(id) ON DELETE SET NULL;


--
-- Name: demandes_reseau_opportunites demandes_reseau_opportunites_profil_reseau_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_reseau_opportunites
    ADD CONSTRAINT demandes_reseau_opportunites_profil_reseau_id_fkey FOREIGN KEY (profil_reseau_id) REFERENCES public.profils_reseau_opportunites(id) ON DELETE SET NULL;


--
-- Name: demandes_reseau_opportunites demandes_reseau_opportunites_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_reseau_opportunites
    ADD CONSTRAINT demandes_reseau_opportunites_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services_reseau_opportunites(id) ON DELETE SET NULL;


--
-- Name: details_employeurs details_employeurs_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.details_employeurs
    ADD CONSTRAINT details_employeurs_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: details_ministeres details_ministeres_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.details_ministeres
    ADD CONSTRAINT details_ministeres_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: details_structures details_structures_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.details_structures
    ADD CONSTRAINT details_structures_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: documents_beneficiaires documents_beneficiaires_beneficiaire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents_beneficiaires
    ADD CONSTRAINT documents_beneficiaires_beneficiaire_id_fkey FOREIGN KEY (beneficiaire_id) REFERENCES public.beneficiaires(id) ON DELETE CASCADE;


--
-- Name: dons_soutiens dons_soutiens_beneficiaire_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dons_soutiens
    ADD CONSTRAINT dons_soutiens_beneficiaire_jeune_id_fkey FOREIGN KEY (beneficiaire_jeune_id) REFERENCES public.jeunes(id) ON DELETE SET NULL;


--
-- Name: dons_soutiens dons_soutiens_donateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dons_soutiens
    ADD CONSTRAINT dons_soutiens_donateur_id_fkey FOREIGN KEY (donateur_id) REFERENCES public.donateurs(id) ON DELETE CASCADE;


--
-- Name: dossiers_beneficiaires dossiers_beneficiaires_beneficiaire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dossiers_beneficiaires
    ADD CONSTRAINT dossiers_beneficiaires_beneficiaire_id_fkey FOREIGN KEY (beneficiaire_id) REFERENCES public.beneficiaires(id) ON DELETE CASCADE;


--
-- Name: eleves_formateurs eleves_formateurs_formateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eleves_formateurs
    ADD CONSTRAINT eleves_formateurs_formateur_id_fkey FOREIGN KEY (formateur_id) REFERENCES public.formateurs(id) ON DELETE SET NULL;


--
-- Name: employeurs employeurs_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employeurs
    ADD CONSTRAINT employeurs_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE CASCADE;


--
-- Name: entretiens entretiens_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entretiens
    ADD CONSTRAINT entretiens_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE CASCADE;


--
-- Name: essais_gratuits essais_gratuits_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essais_gratuits
    ADD CONSTRAINT essais_gratuits_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: affectations_beneficiaires_personnel fk_affectations_beneficiaire; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affectations_beneficiaires_personnel
    ADD CONSTRAINT fk_affectations_beneficiaire FOREIGN KEY (beneficiaire_id) REFERENCES public.beneficiaires(id) ON DELETE CASCADE;


--
-- Name: affectations_beneficiaires_personnel fk_affectations_personnel; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affectations_beneficiaires_personnel
    ADD CONSTRAINT fk_affectations_personnel FOREIGN KEY (personnel_structures_id) REFERENCES public.personnel_structures(id) ON DELETE CASCADE;


--
-- Name: classes fk_classes_formateur; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT fk_classes_formateur FOREIGN KEY (formateur_id) REFERENCES public.formateurs(id) ON DELETE SET NULL;


--
-- Name: garants_suivi garants_suivi_eleve_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garants_suivi
    ADD CONSTRAINT garants_suivi_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves_independants(id) ON DELETE CASCADE;


--
-- Name: historique_validations_abc historique_validations_abc_demande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_validations_abc
    ADD CONSTRAINT historique_validations_abc_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES public.demandes_acces_abc(id) ON DELETE CASCADE;


--
-- Name: iga_scores iga_scores_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iga_scores
    ADD CONSTRAINT iga_scores_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE CASCADE;


--
-- Name: implantations implantations_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implantations
    ADD CONSTRAINT implantations_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: inscriptions_activites inscriptions_activites_activite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscriptions_activites
    ADD CONSTRAINT inscriptions_activites_activite_id_fkey FOREIGN KEY (activite_id) REFERENCES public.activites(id) ON DELETE CASCADE;


--
-- Name: inscriptions_activites inscriptions_activites_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscriptions_activites
    ADD CONSTRAINT inscriptions_activites_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE SET NULL;


--
-- Name: insertion_sociopro insertion_sociopro_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insertion_sociopro
    ADD CONSTRAINT insertion_sociopro_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE CASCADE;


--
-- Name: insertions_sociopro insertions_sociopro_beneficiaire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insertions_sociopro
    ADD CONSTRAINT insertions_sociopro_beneficiaire_id_fkey FOREIGN KEY (beneficiaire_id) REFERENCES public.beneficiaires(id) ON DELETE SET NULL;


--
-- Name: intelligence_economique intelligence_economique_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intelligence_economique
    ADD CONSTRAINT intelligence_economique_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE CASCADE;


--
-- Name: invitations_utilisateurs invitations_utilisateurs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations_utilisateurs
    ADD CONSTRAINT invitations_utilisateurs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: invitations_utilisateurs invitations_utilisateurs_invite_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations_utilisateurs
    ADD CONSTRAINT invitations_utilisateurs_invite_par_fkey FOREIGN KEY (invite_par) REFERENCES public.profiles(id);


--
-- Name: invitations_utilisateurs invitations_utilisateurs_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations_utilisateurs
    ADD CONSTRAINT invitations_utilisateurs_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: invitations_utilisateurs invitations_utilisateurs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations_utilisateurs
    ADD CONSTRAINT invitations_utilisateurs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: licences licences_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licences
    ADD CONSTRAINT licences_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: logs_acces_donnees logs_acces_donnees_super_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_acces_donnees
    ADD CONSTRAINT logs_acces_donnees_super_admin_id_fkey FOREIGN KEY (super_admin_id) REFERENCES public.super_admins(id) ON DELETE CASCADE;


--
-- Name: membres_organisations membres_organisations_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membres_organisations
    ADD CONSTRAINT membres_organisations_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: mentors mentors_beneficiaire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentors
    ADD CONSTRAINT mentors_beneficiaire_id_fkey FOREIGN KEY (beneficiaire_id) REFERENCES public.beneficiaires(id) ON DELETE CASCADE;


--
-- Name: modules_actives modules_actives_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules_actives
    ADD CONSTRAINT modules_actives_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: objectifs_eleves_formateurs objectifs_eleves_formateurs_eleve_formateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectifs_eleves_formateurs
    ADD CONSTRAINT objectifs_eleves_formateurs_eleve_formateur_id_fkey FOREIGN KEY (eleve_formateur_id) REFERENCES public.eleves_formateurs(id) ON DELETE SET NULL;


--
-- Name: offres_emploi offres_emploi_employeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offres_emploi
    ADD CONSTRAINT offres_emploi_employeur_id_fkey FOREIGN KEY (employeur_id) REFERENCES public.employeurs(id);


--
-- Name: offres_emploi offres_emploi_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offres_emploi
    ADD CONSTRAINT offres_emploi_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id);


--
-- Name: paiements_abonnements_abc paiements_abonnements_abc_abonnement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements_abonnements_abc
    ADD CONSTRAINT paiements_abonnements_abc_abonnement_id_fkey FOREIGN KEY (abonnement_id) REFERENCES public.abonnements_clients_abc(id) ON DELETE SET NULL;


--
-- Name: paiements_abonnements_abc paiements_abonnements_abc_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements_abonnements_abc
    ADD CONSTRAINT paiements_abonnements_abc_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans_abonnement_abc(id) ON DELETE SET NULL;


--
-- Name: paiements_intelligence_economique paiements_intelligence_economique_abonnement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements_intelligence_economique
    ADD CONSTRAINT paiements_intelligence_economique_abonnement_id_fkey FOREIGN KEY (abonnement_id) REFERENCES public.abonnements_intelligence_economique(id) ON DELETE SET NULL;


--
-- Name: paiements_intelligence_economique paiements_intelligence_economique_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements_intelligence_economique
    ADD CONSTRAINT paiements_intelligence_economique_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans_intelligence_economique(id) ON DELETE SET NULL;


--
-- Name: parents_tuteurs parents_tuteurs_beneficiaire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents_tuteurs
    ADD CONSTRAINT parents_tuteurs_beneficiaire_id_fkey FOREIGN KEY (beneficiaire_id) REFERENCES public.beneficiaires(id) ON DELETE CASCADE;


--
-- Name: permissions permissions_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: permissions permissions_role_utilisateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_role_utilisateur_id_fkey FOREIGN KEY (role_utilisateur_id) REFERENCES public.roles_utilisateurs(id) ON DELETE CASCADE;


--
-- Name: personnel_structures personnel_structures_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_structures
    ADD CONSTRAINT personnel_structures_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id);


--
-- Name: pieces_demandes_abc pieces_demandes_abc_demande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pieces_demandes_abc
    ADD CONSTRAINT pieces_demandes_abc_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES public.demandes_acces_abc(id) ON DELETE CASCADE;


--
-- Name: pieces_identite_inscriptions pieces_identite_inscriptions_eleve_formateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pieces_identite_inscriptions
    ADD CONSTRAINT pieces_identite_inscriptions_eleve_formateur_id_fkey FOREIGN KEY (eleve_formateur_id) REFERENCES public.eleves_formateurs(id) ON DELETE CASCADE;


--
-- Name: pieces_identite_inscriptions pieces_identite_inscriptions_eleve_independant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pieces_identite_inscriptions
    ADD CONSTRAINT pieces_identite_inscriptions_eleve_independant_id_fkey FOREIGN KEY (eleve_independant_id) REFERENCES public.eleves_independants(id) ON DELETE CASCADE;


--
-- Name: preuves_competences preuves_competences_competence_eleve_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preuves_competences
    ADD CONSTRAINT preuves_competences_competence_eleve_id_fkey FOREIGN KEY (competence_eleve_id) REFERENCES public.competences_eleves(id) ON DELETE CASCADE;


--
-- Name: profils profils_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils
    ADD CONSTRAINT profils_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profils_recherche_emploi profils_recherche_emploi_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils_recherche_emploi
    ADD CONSTRAINT profils_recherche_emploi_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id);


--
-- Name: projet_de_vie projet_de_vie_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projet_de_vie
    ADD CONSTRAINT projet_de_vie_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE CASCADE;


--
-- Name: projets_financement projets_financement_beneficiaire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets_financement
    ADD CONSTRAINT projets_financement_beneficiaire_id_fkey FOREIGN KEY (beneficiaire_id) REFERENCES public.beneficiaires(id) ON DELETE SET NULL;


--
-- Name: quotas_organisations quotas_organisations_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotas_organisations
    ADD CONSTRAINT quotas_organisations_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: recommandations_intelligence_economique recommandations_intelligence_economique_opportunite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommandations_intelligence_economique
    ADD CONSTRAINT recommandations_intelligence_economique_opportunite_id_fkey FOREIGN KEY (opportunite_id) REFERENCES public.opportunites_economiques(id) ON DELETE SET NULL;


--
-- Name: recommandations_intelligence_economique recommandations_intelligence_economique_profil_ie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommandations_intelligence_economique
    ADD CONSTRAINT recommandations_intelligence_economique_profil_ie_id_fkey FOREIGN KEY (profil_ie_id) REFERENCES public.profils_intelligence_economique(id) ON DELETE SET NULL;


--
-- Name: resultats_reseau_opportunites resultats_reseau_opportunites_demande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultats_reseau_opportunites
    ADD CONSTRAINT resultats_reseau_opportunites_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES public.demandes_reseau_opportunites(id) ON DELETE CASCADE;


--
-- Name: sante_bien_etre sante_bien_etre_jeune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sante_bien_etre
    ADD CONSTRAINT sante_bien_etre_jeune_id_fkey FOREIGN KEY (jeune_id) REFERENCES public.jeunes(id) ON DELETE CASCADE;


--
-- Name: scores_iga scores_iga_beneficiaire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scores_iga
    ADD CONSTRAINT scores_iga_beneficiaire_id_fkey FOREIGN KEY (beneficiaire_id) REFERENCES public.beneficiaires(id) ON DELETE CASCADE;


--
-- Name: services_reseau_opportunites services_reseau_opportunites_profil_reseau_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services_reseau_opportunites
    ADD CONSTRAINT services_reseau_opportunites_profil_reseau_id_fkey FOREIGN KEY (profil_reseau_id) REFERENCES public.profils_reseau_opportunites(id) ON DELETE CASCADE;


--
-- Name: sessions_connexion sessions_connexion_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_connexion
    ADD CONSTRAINT sessions_connexion_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: sessions_connexion sessions_connexion_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_connexion
    ADD CONSTRAINT sessions_connexion_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: sessions_connexion sessions_connexion_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_connexion
    ADD CONSTRAINT sessions_connexion_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: sessions_connexion sessions_connexion_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_connexion
    ADD CONSTRAINT sessions_connexion_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: suivis_eleves_formateurs suivis_eleves_formateurs_eleve_formateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis_eleves_formateurs
    ADD CONSTRAINT suivis_eleves_formateurs_eleve_formateur_id_fkey FOREIGN KEY (eleve_formateur_id) REFERENCES public.eleves_formateurs(id) ON DELETE SET NULL;


--
-- Name: suivis_eleves_formateurs suivis_eleves_formateurs_formateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis_eleves_formateurs
    ADD CONSTRAINT suivis_eleves_formateurs_formateur_id_fkey FOREIGN KEY (formateur_id) REFERENCES public.formateurs(id) ON DELETE SET NULL;


--
-- Name: suivis_mentorat_psychoeduc suivis_mentorat_psychoeduc_eleve_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis_mentorat_psychoeduc
    ADD CONSTRAINT suivis_mentorat_psychoeduc_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves_independants(id) ON DELETE CASCADE;


--
-- Name: suivis_mentorat_psychoeduc suivis_mentorat_psychoeduc_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis_mentorat_psychoeduc
    ADD CONSTRAINT suivis_mentorat_psychoeduc_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.mentors_psychoeduc(id) ON DELETE CASCADE;


--
-- Name: super_admins super_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: taches_ia_psychoeduc taches_ia_psychoeduc_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taches_ia_psychoeduc
    ADD CONSTRAINT taches_ia_psychoeduc_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents_ia_psychoeduc(id);


--
-- Name: transactions_wallet transactions_wallet_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions_wallet
    ADD CONSTRAINT transactions_wallet_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: transactions_wallet transactions_wallet_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions_wallet
    ADD CONSTRAINT transactions_wallet_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallet_fondateur(id) ON DELETE CASCADE;


--
-- Name: utilisateurs_roles utilisateurs_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs_roles
    ADD CONSTRAINT utilisateurs_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: validations_competences validations_competences_competence_eleve_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validations_competences
    ADD CONSTRAINT validations_competences_competence_eleve_id_fkey FOREIGN KEY (competence_eleve_id) REFERENCES public.competences_eleves(id) ON DELETE CASCADE;


--
-- Name: validations_competences validations_competences_preuve_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validations_competences
    ADD CONSTRAINT validations_competences_preuve_id_fkey FOREIGN KEY (preuve_id) REFERENCES public.preuves_competences(id) ON DELETE SET NULL;


--
-- Name: validations_suivi_independant validations_suivi_independant_eleve_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validations_suivi_independant
    ADD CONSTRAINT validations_suivi_independant_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES public.eleves_independants(id) ON DELETE CASCADE;


--
-- Name: wallet_fondateur wallet_fondateur_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_fondateur
    ADD CONSTRAINT wallet_fondateur_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: documents_beneficiaires Founder read documents_beneficiaires; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Founder read documents_beneficiaires" ON public.documents_beneficiaires FOR SELECT TO authenticated USING (public.is_fondateur());


--
-- Name: dossiers_beneficiaires Founder read dossiers_beneficiaires; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Founder read dossiers_beneficiaires" ON public.dossiers_beneficiaires FOR SELECT TO authenticated USING (public.is_fondateur());


--
-- Name: mentors Founder read mentors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Founder read mentors" ON public.mentors FOR SELECT TO authenticated USING (public.is_fondateur());


--
-- Name: parents_tuteurs Founder read parents_tuteurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Founder read parents_tuteurs" ON public.parents_tuteurs FOR SELECT TO authenticated USING (public.is_fondateur());


--
-- Name: documents_beneficiaires Founder write documents_beneficiaires; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Founder write documents_beneficiaires" ON public.documents_beneficiaires TO authenticated USING (public.is_fondateur()) WITH CHECK (public.is_fondateur());


--
-- Name: dossiers_beneficiaires Founder write dossiers_beneficiaires; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Founder write dossiers_beneficiaires" ON public.dossiers_beneficiaires TO authenticated USING (public.is_fondateur()) WITH CHECK (public.is_fondateur());


--
-- Name: mentors Founder write mentors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Founder write mentors" ON public.mentors TO authenticated USING (public.is_fondateur()) WITH CHECK (public.is_fondateur());


--
-- Name: parents_tuteurs Founder write parents_tuteurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Founder write parents_tuteurs" ON public.parents_tuteurs TO authenticated USING (public.is_fondateur()) WITH CHECK (public.is_fondateur());


--
-- Name: eleves Lecture publique eleves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture publique eleves" ON public.eleves FOR SELECT TO anon USING (true);


--
-- Name: abonnements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abonnements ENABLE ROW LEVEL SECURITY;

--
-- Name: abonnements_clients_abc abonnements_abc_clients_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY abonnements_abc_clients_org_select ON public.abonnements_clients_abc FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT membres_organisations.organisation_id
   FROM public.membres_organisations
  WHERE (membres_organisations.user_id = auth.uid())))));


--
-- Name: abonnements_clients_abc abonnements_abc_clients_org_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY abonnements_abc_clients_org_write ON public.abonnements_clients_abc TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT membres_organisations.organisation_id
   FROM public.membres_organisations
  WHERE (membres_organisations.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT membres_organisations.organisation_id
   FROM public.membres_organisations
  WHERE (membres_organisations.user_id = auth.uid())))));


--
-- Name: abonnements_clients_abc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abonnements_clients_abc ENABLE ROW LEVEL SECURITY;

--
-- Name: abonnements_emploi_premium; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abonnements_emploi_premium ENABLE ROW LEVEL SECURITY;

--
-- Name: abonnements_formateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abonnements_formateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: abonnements_intelligence_economique abonnements_ie_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY abonnements_ie_org_select ON public.abonnements_intelligence_economique FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT membres_organisations.organisation_id
   FROM public.membres_organisations
  WHERE (membres_organisations.user_id = auth.uid())))));


--
-- Name: abonnements_intelligence_economique abonnements_ie_org_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY abonnements_ie_org_write ON public.abonnements_intelligence_economique TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT membres_organisations.organisation_id
   FROM public.membres_organisations
  WHERE (membres_organisations.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT membres_organisations.organisation_id
   FROM public.membres_organisations
  WHERE (membres_organisations.user_id = auth.uid())))));


--
-- Name: abonnements_intelligence_economique; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abonnements_intelligence_economique ENABLE ROW LEVEL SECURITY;

--
-- Name: abonnements_mentorat_psychoeduc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abonnements_mentorat_psychoeduc ENABLE ROW LEVEL SECURITY;

--
-- Name: abonnements_reseau_opportunites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abonnements_reseau_opportunites ENABLE ROW LEVEL SECURITY;

--
-- Name: abonnements_reseau_opportunites abonnements_reseau_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY abonnements_reseau_org_select ON public.abonnements_reseau_opportunites FOR SELECT TO authenticated USING ((public.is_fondateur() OR (EXISTS ( SELECT 1
   FROM public.profils_reseau_opportunites pr
  WHERE ((pr.id = abonnements_reseau_opportunites.profil_reseau_id) AND (pr.organisation_id IN ( SELECT membres_organisations.organisation_id
           FROM public.membres_organisations
          WHERE (membres_organisations.user_id = auth.uid()))))))));


--
-- Name: abonnements_reseau_opportunites abonnements_reseau_org_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY abonnements_reseau_org_write ON public.abonnements_reseau_opportunites TO authenticated USING ((public.is_fondateur() OR (EXISTS ( SELECT 1
   FROM public.profils_reseau_opportunites pr
  WHERE ((pr.id = abonnements_reseau_opportunites.profil_reseau_id) AND (pr.organisation_id IN ( SELECT membres_organisations.organisation_id
           FROM public.membres_organisations
          WHERE (membres_organisations.user_id = auth.uid())))))))) WITH CHECK ((public.is_fondateur() OR (EXISTS ( SELECT 1
   FROM public.profils_reseau_opportunites pr
  WHERE ((pr.id = abonnements_reseau_opportunites.profil_reseau_id) AND (pr.organisation_id IN ( SELECT membres_organisations.organisation_id
           FROM public.membres_organisations
          WHERE (membres_organisations.user_id = auth.uid()))))))));


--
-- Name: activites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activites ENABLE ROW LEVEL SECURITY;

--
-- Name: activites activites_delete_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activites_delete_block ON public.activites FOR DELETE TO authenticated USING (false);


--
-- Name: activites activites_insert_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activites_insert_block ON public.activites FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: activites activites_select_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activites_select_block ON public.activites FOR SELECT TO authenticated USING (false);


--
-- Name: activites activites_update_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activites_update_block ON public.activites FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: affectations_beneficiaires_personnel; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affectations_beneficiaires_personnel ENABLE ROW LEVEL SECURITY;

--
-- Name: affectations_mentors_psychoeduc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affectations_mentors_psychoeduc ENABLE ROW LEVEL SECURITY;

--
-- Name: affectations_personnel; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affectations_personnel ENABLE ROW LEVEL SECURITY;

--
-- Name: affectations_personnel affectations_personnel_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY affectations_personnel_select ON public.affectations_personnel FOR SELECT TO authenticated USING ((public.is_fondateur() OR public.est_membre_organisation(organisation_id)));


--
-- Name: affectations_personnel affectations_personnel_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY affectations_personnel_write ON public.affectations_personnel TO authenticated USING ((public.is_fondateur() OR public.est_membre_organisation(organisation_id))) WITH CHECK ((public.is_fondateur() OR public.est_membre_organisation(organisation_id)));


--
-- Name: agents_ia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agents_ia ENABLE ROW LEVEL SECURITY;

--
-- Name: agents_ia_psychoeduc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agents_ia_psychoeduc ENABLE ROW LEVEL SECURITY;

--
-- Name: alertes_emploi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alertes_emploi ENABLE ROW LEVEL SECURITY;

--
-- Name: alertes_intelligence_economique; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alertes_intelligence_economique ENABLE ROW LEVEL SECURITY;

--
-- Name: alertes_suivi_independant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alertes_suivi_independant ENABLE ROW LEVEL SECURITY;

--
-- Name: anciens_beneficiaires; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anciens_beneficiaires ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_select_fondateur; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_select_fondateur ON public.audit_logs FOR SELECT TO authenticated USING (public.is_fondateur());


--
-- Name: avis_formateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.avis_formateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: avis_reseau_opportunites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.avis_reseau_opportunites ENABLE ROW LEVEL SECURITY;

--
-- Name: badges_eleves; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.badges_eleves ENABLE ROW LEVEL SECURITY;

--
-- Name: beneficiaires; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beneficiaires ENABLE ROW LEVEL SECURITY;

--
-- Name: campagnes_soutien; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campagnes_soutien ENABLE ROW LEVEL SECURITY;

--
-- Name: campagnes_soutien campagnes_soutien_delete_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campagnes_soutien_delete_block ON public.campagnes_soutien FOR DELETE TO authenticated USING (false);


--
-- Name: campagnes_soutien campagnes_soutien_insert_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campagnes_soutien_insert_block ON public.campagnes_soutien FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: campagnes_soutien campagnes_soutien_select_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campagnes_soutien_select_block ON public.campagnes_soutien FOR SELECT TO authenticated USING (false);


--
-- Name: campagnes_soutien campagnes_soutien_update_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campagnes_soutien_update_block ON public.campagnes_soutien FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: candidatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.candidatures ENABLE ROW LEVEL SECURITY;

--
-- Name: capital_social; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capital_social ENABLE ROW LEVEL SECURITY;

--
-- Name: citoyennete_leadership; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.citoyennete_leadership ENABLE ROW LEVEL SECURITY;

--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: codes_promo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.codes_promo ENABLE ROW LEVEL SECURITY;

--
-- Name: commissions_plateforme; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commissions_plateforme ENABLE ROW LEVEL SECURITY;

--
-- Name: competences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competences ENABLE ROW LEVEL SECURITY;

--
-- Name: competences_eleves; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competences_eleves ENABLE ROW LEVEL SECURITY;

--
-- Name: composants_dashboard; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.composants_dashboard ENABLE ROW LEVEL SECURITY;

--
-- Name: concours_etat; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concours_etat ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts contacts_delete_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_delete_block ON public.contacts FOR DELETE TO authenticated USING (false);


--
-- Name: contacts contacts_insert_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_insert_block ON public.contacts FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: contacts contacts_select_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_select_block ON public.contacts FOR SELECT TO authenticated USING (false);


--
-- Name: contacts contacts_update_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_update_block ON public.contacts FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: contributions_financement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contributions_financement ENABLE ROW LEVEL SECURITY;

--
-- Name: deblocages_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deblocages_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: demandes_acces_abc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demandes_acces_abc ENABLE ROW LEVEL SECURITY;

--
-- Name: demandes_assistance_suivi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demandes_assistance_suivi ENABLE ROW LEVEL SECURITY;

--
-- Name: demandes_creation_niveaux_abc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demandes_creation_niveaux_abc ENABLE ROW LEVEL SECURITY;

--
-- Name: demandes_reseau_opportunites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demandes_reseau_opportunites ENABLE ROW LEVEL SECURITY;

--
-- Name: details_employeurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.details_employeurs ENABLE ROW LEVEL SECURITY;

--
-- Name: details_employeurs details_employeurs_select_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY details_employeurs_select_org ON public.details_employeurs FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: details_employeurs details_employeurs_write_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY details_employeurs_write_org ON public.details_employeurs TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: details_ministeres; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.details_ministeres ENABLE ROW LEVEL SECURITY;

--
-- Name: details_ministeres details_ministeres_select_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY details_ministeres_select_org ON public.details_ministeres FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: details_ministeres details_ministeres_write_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY details_ministeres_write_org ON public.details_ministeres TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: details_structures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.details_structures ENABLE ROW LEVEL SECURITY;

--
-- Name: details_structures details_structures_select_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY details_structures_select_org ON public.details_structures FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: details_structures details_structures_write_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY details_structures_write_org ON public.details_structures TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: documents_beneficiaires; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents_beneficiaires ENABLE ROW LEVEL SECURITY;

--
-- Name: donateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.donateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: donateurs donateurs_delete_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donateurs_delete_block ON public.donateurs FOR DELETE TO authenticated USING (false);


--
-- Name: donateurs donateurs_insert_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donateurs_insert_block ON public.donateurs FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: donateurs donateurs_select_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donateurs_select_block ON public.donateurs FOR SELECT TO authenticated USING (false);


--
-- Name: donateurs donateurs_update_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY donateurs_update_block ON public.donateurs FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: dons_soutiens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dons_soutiens ENABLE ROW LEVEL SECURITY;

--
-- Name: dons_soutiens dons_soutiens_delete_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dons_soutiens_delete_block ON public.dons_soutiens FOR DELETE TO authenticated USING (false);


--
-- Name: dons_soutiens dons_soutiens_insert_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dons_soutiens_insert_block ON public.dons_soutiens FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: dons_soutiens dons_soutiens_select_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dons_soutiens_select_block ON public.dons_soutiens FOR SELECT TO authenticated USING (false);


--
-- Name: dons_soutiens dons_soutiens_update_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dons_soutiens_update_block ON public.dons_soutiens FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: dossiers_beneficiaires; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dossiers_beneficiaires ENABLE ROW LEVEL SECURITY;

--
-- Name: eleves; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eleves ENABLE ROW LEVEL SECURITY;

--
-- Name: eleves_formateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eleves_formateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: eleves_independants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eleves_independants ENABLE ROW LEVEL SECURITY;

--
-- Name: employeurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employeurs ENABLE ROW LEVEL SECURITY;

--
-- Name: entretiens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entretiens ENABLE ROW LEVEL SECURITY;

--
-- Name: essais_gratuits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.essais_gratuits ENABLE ROW LEVEL SECURITY;

--
-- Name: essais_gratuits essais_select_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY essais_select_org ON public.essais_gratuits FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: essais_gratuits essais_write_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY essais_write_org ON public.essais_gratuits TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: etapes_plans_intervention; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.etapes_plans_intervention ENABLE ROW LEVEL SECURITY;

--
-- Name: etapes_programmes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.etapes_programmes ENABLE ROW LEVEL SECURITY;

--
-- Name: formateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.formateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: formations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;

--
-- Name: formations_catalogue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.formations_catalogue ENABLE ROW LEVEL SECURITY;

--
-- Name: fournisseurs_paiement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fournisseurs_paiement ENABLE ROW LEVEL SECURITY;

--
-- Name: garants_suivi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.garants_suivi ENABLE ROW LEVEL SECURITY;

--
-- Name: historique_validations_abc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historique_validations_abc ENABLE ROW LEVEL SECURITY;

--
-- Name: iga_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.iga_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: implantations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.implantations ENABLE ROW LEVEL SECURITY;

--
-- Name: implantations implantations_select_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY implantations_select_org ON public.implantations FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: implantations implantations_write_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY implantations_write_org ON public.implantations TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: incidents_disciplinaires; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incidents_disciplinaires ENABLE ROW LEVEL SECURITY;

--
-- Name: inscriptions_activites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inscriptions_activites ENABLE ROW LEVEL SECURITY;

--
-- Name: inscriptions_activites inscriptions_delete_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inscriptions_delete_block ON public.inscriptions_activites FOR DELETE TO authenticated USING (false);


--
-- Name: inscriptions_formations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inscriptions_formations ENABLE ROW LEVEL SECURITY;

--
-- Name: inscriptions_activites inscriptions_insert_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inscriptions_insert_block ON public.inscriptions_activites FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: inscriptions_programmes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inscriptions_programmes ENABLE ROW LEVEL SECURITY;

--
-- Name: inscriptions_activites inscriptions_select_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inscriptions_select_block ON public.inscriptions_activites FOR SELECT TO authenticated USING (false);


--
-- Name: inscriptions_activites inscriptions_update_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inscriptions_update_block ON public.inscriptions_activites FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: insertion_sociopro; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insertion_sociopro ENABLE ROW LEVEL SECURITY;

--
-- Name: insertions_sociopro; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insertions_sociopro ENABLE ROW LEVEL SECURITY;

--
-- Name: instances_saas_pays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.instances_saas_pays ENABLE ROW LEVEL SECURITY;

--
-- Name: intelligence_economique; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intelligence_economique ENABLE ROW LEVEL SECURITY;

--
-- Name: invitations_abc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations_abc ENABLE ROW LEVEL SECURITY;

--
-- Name: invitations_utilisateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations_utilisateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: invitations_utilisateurs invitations_utilisateurs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invitations_utilisateurs_delete ON public.invitations_utilisateurs FOR DELETE TO authenticated USING ((public.is_fondateur() OR public.est_membre_organisation(organisation_id)));


--
-- Name: invitations_utilisateurs invitations_utilisateurs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invitations_utilisateurs_insert ON public.invitations_utilisateurs FOR INSERT TO authenticated WITH CHECK ((public.is_fondateur() OR public.est_membre_organisation(organisation_id)));


--
-- Name: invitations_utilisateurs invitations_utilisateurs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invitations_utilisateurs_select ON public.invitations_utilisateurs FOR SELECT TO authenticated USING ((public.is_fondateur() OR public.est_membre_organisation(organisation_id)));


--
-- Name: invitations_utilisateurs invitations_utilisateurs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invitations_utilisateurs_update ON public.invitations_utilisateurs FOR UPDATE TO authenticated USING ((public.is_fondateur() OR public.est_membre_organisation(organisation_id))) WITH CHECK ((public.is_fondateur() OR public.est_membre_organisation(organisation_id)));


--
-- Name: jeunes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jeunes ENABLE ROW LEVEL SECURITY;

--
-- Name: licences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.licences ENABLE ROW LEVEL SECURITY;

--
-- Name: licences licences_select_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY licences_select_org ON public.licences FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: licences licences_write_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY licences_write_org ON public.licences TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: logs_acces_donnees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.logs_acces_donnees ENABLE ROW LEVEL SECURITY;

--
-- Name: membres_organisations membres_delete_fondateur; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY membres_delete_fondateur ON public.membres_organisations FOR DELETE TO authenticated USING (public.is_fondateur());


--
-- Name: membres_organisations membres_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY membres_insert ON public.membres_organisations FOR INSERT TO authenticated WITH CHECK (((organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid()))) OR public.is_fondateur()));


--
-- Name: membres_organisations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.membres_organisations ENABLE ROW LEVEL SECURITY;

--
-- Name: membres_organisations membres_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY membres_select ON public.membres_organisations FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: mentors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;

--
-- Name: mentors_psychoeduc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentors_psychoeduc ENABLE ROW LEVEL SECURITY;

--
-- Name: modules_actives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modules_actives ENABLE ROW LEVEL SECURITY;

--
-- Name: modules_actives modules_actives_select_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_actives_select_org ON public.modules_actives FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: modules_actives modules_actives_write_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_actives_write_org ON public.modules_actives TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: niveaux_abc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.niveaux_abc ENABLE ROW LEVEL SECURITY;

--
-- Name: objectifs_beneficiaires; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.objectifs_beneficiaires ENABLE ROW LEVEL SECURITY;

--
-- Name: objectifs_eleves_formateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.objectifs_eleves_formateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: offres_emploi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offres_emploi ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunites_economiques; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.opportunites_economiques ENABLE ROW LEVEL SECURITY;

--
-- Name: organisations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

--
-- Name: organisations organisations_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organisations_select_members ON public.organisations FOR SELECT TO authenticated USING ((public.is_fondateur() OR public.est_membre_organisation(id)));


--
-- Name: organisations organisations_update_fondateur; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organisations_update_fondateur ON public.organisations FOR UPDATE TO authenticated USING (public.is_fondateur()) WITH CHECK (public.is_fondateur());


--
-- Name: pages_interface; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pages_interface ENABLE ROW LEVEL SECURITY;

--
-- Name: paiements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

--
-- Name: paiements_abonnements_abc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.paiements_abonnements_abc ENABLE ROW LEVEL SECURITY;

--
-- Name: paiements_intelligence_economique; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.paiements_intelligence_economique ENABLE ROW LEVEL SECURITY;

--
-- Name: parents_tuteurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parents_tuteurs ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions permissions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: personnel_structures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnel_structures ENABLE ROW LEVEL SECURITY;

--
-- Name: pieces_demandes_abc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pieces_demandes_abc ENABLE ROW LEVEL SECURITY;

--
-- Name: pieces_identite_inscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pieces_identite_inscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: plans_abonnement_abc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans_abonnement_abc ENABLE ROW LEVEL SECURITY;

--
-- Name: plans_emploi_premium; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans_emploi_premium ENABLE ROW LEVEL SECURITY;

--
-- Name: plans_intelligence_economique; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans_intelligence_economique ENABLE ROW LEVEL SECURITY;

--
-- Name: plans_intervention_personnalises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans_intervention_personnalises ENABLE ROW LEVEL SECURITY;

--
-- Name: plans_mentorat_psychoeduc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans_mentorat_psychoeduc ENABLE ROW LEVEL SECURITY;

--
-- Name: plans_reseau_opportunites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans_reseau_opportunites ENABLE ROW LEVEL SECURITY;

--
-- Name: preuves_competences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preuves_competences ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profils; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profils ENABLE ROW LEVEL SECURITY;

--
-- Name: profils_intelligence_economique; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profils_intelligence_economique ENABLE ROW LEVEL SECURITY;

--
-- Name: profils_recherche_emploi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profils_recherche_emploi ENABLE ROW LEVEL SECURITY;

--
-- Name: profils_reseau_opportunites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profils_reseau_opportunites ENABLE ROW LEVEL SECURITY;

--
-- Name: programmes_suivi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.programmes_suivi ENABLE ROW LEVEL SECURITY;

--
-- Name: projet_de_vie; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projet_de_vie ENABLE ROW LEVEL SECURITY;

--
-- Name: projets_financement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projets_financement ENABLE ROW LEVEL SECURITY;

--
-- Name: abonnements psychoeduc_delete_auth_abonnements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_delete_auth_abonnements ON public.abonnements FOR DELETE TO authenticated USING (true);


--
-- Name: eleves psychoeduc_delete_auth_eleves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_delete_auth_eleves ON public.eleves FOR DELETE TO authenticated USING (true);


--
-- Name: employeurs psychoeduc_delete_auth_employeurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_delete_auth_employeurs ON public.employeurs FOR DELETE TO authenticated USING (true);


--
-- Name: paiements psychoeduc_delete_auth_paiements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_delete_auth_paiements ON public.paiements FOR DELETE TO authenticated USING (true);


--
-- Name: abonnements psychoeduc_insert_auth_abonnements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_insert_auth_abonnements ON public.abonnements FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: eleves psychoeduc_insert_auth_eleves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_insert_auth_eleves ON public.eleves FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: employeurs psychoeduc_insert_auth_employeurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_insert_auth_employeurs ON public.employeurs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: paiements psychoeduc_insert_auth_paiements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_insert_auth_paiements ON public.paiements FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: abonnements psychoeduc_lecture_auth_abonnements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_lecture_auth_abonnements ON public.abonnements FOR SELECT TO authenticated USING (true);


--
-- Name: eleves psychoeduc_lecture_auth_eleves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_lecture_auth_eleves ON public.eleves FOR SELECT TO authenticated USING (true);


--
-- Name: employeurs psychoeduc_lecture_auth_employeurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_lecture_auth_employeurs ON public.employeurs FOR SELECT TO authenticated USING (true);


--
-- Name: paiements psychoeduc_lecture_auth_paiements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_lecture_auth_paiements ON public.paiements FOR SELECT TO authenticated USING (true);


--
-- Name: abonnements psychoeduc_update_auth_abonnements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_update_auth_abonnements ON public.abonnements FOR UPDATE TO authenticated USING (true);


--
-- Name: eleves psychoeduc_update_auth_eleves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_update_auth_eleves ON public.eleves FOR UPDATE TO authenticated USING (true);


--
-- Name: employeurs psychoeduc_update_auth_employeurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_update_auth_employeurs ON public.employeurs FOR UPDATE TO authenticated USING (true);


--
-- Name: paiements psychoeduc_update_auth_paiements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY psychoeduc_update_auth_paiements ON public.paiements FOR UPDATE TO authenticated USING (true);


--
-- Name: quotas_organisations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotas_organisations ENABLE ROW LEVEL SECURITY;

--
-- Name: quotas_organisations quotas_select_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotas_select_org ON public.quotas_organisations FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: quotas_organisations quotas_write_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotas_write_org ON public.quotas_organisations TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: rapports_suivi_eleves_formateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rapports_suivi_eleves_formateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: recherches_intelligence_economique; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recherches_intelligence_economique ENABLE ROW LEVEL SECURITY;

--
-- Name: recherches_travailleurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recherches_travailleurs ENABLE ROW LEVEL SECURITY;

--
-- Name: recommandations_educatives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recommandations_educatives ENABLE ROW LEVEL SECURITY;

--
-- Name: recommandations_ia_psychoeduc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recommandations_ia_psychoeduc ENABLE ROW LEVEL SECURITY;

--
-- Name: recommandations_intelligence_economique; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recommandations_intelligence_economique ENABLE ROW LEVEL SECURITY;

--
-- Name: referentiel_metiers_formations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referentiel_metiers_formations ENABLE ROW LEVEL SECURITY;

--
-- Name: reservations_formateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservations_formateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: resultats_reseau_opportunites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resultats_reseau_opportunites ENABLE ROW LEVEL SECURITY;

--
-- Name: risques_predictifs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.risques_predictifs ENABLE ROW LEVEL SECURITY;

--
-- Name: roles_utilisateurs roles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_select ON public.roles_utilisateurs FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: roles_utilisateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles_utilisateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: sante_bien_etre; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sante_bien_etre ENABLE ROW LEVEL SECURITY;

--
-- Name: scores_iga; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scores_iga ENABLE ROW LEVEL SECURITY;

--
-- Name: services_formateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services_formateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: services_reseau_opportunites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services_reseau_opportunites ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions_connexion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions_connexion ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions_connexion sessions_connexion_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_connexion_all ON public.sessions_connexion TO authenticated USING ((public.is_fondateur() OR public.est_membre_organisation(organisation_id))) WITH CHECK ((public.is_fondateur() OR public.est_membre_organisation(organisation_id)));


--
-- Name: sessions_connexion sessions_connexion_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_connexion_select ON public.sessions_connexion FOR SELECT TO authenticated USING ((public.is_fondateur() OR public.est_membre_organisation(organisation_id)));


--
-- Name: soutiens_jeune; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.soutiens_jeune ENABLE ROW LEVEL SECURITY;

--
-- Name: stages_apprentissages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stages_apprentissages ENABLE ROW LEVEL SECURITY;

--
-- Name: structures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.structures ENABLE ROW LEVEL SECURITY;

--
-- Name: structures_abc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.structures_abc ENABLE ROW LEVEL SECURITY;

--
-- Name: suggestions_referentiel; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suggestions_referentiel ENABLE ROW LEVEL SECURITY;

--
-- Name: suivis_eleves_formateurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suivis_eleves_formateurs ENABLE ROW LEVEL SECURITY;

--
-- Name: suivis_mentorat_psychoeduc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suivis_mentorat_psychoeduc ENABLE ROW LEVEL SECURITY;

--
-- Name: suivis_post_insertion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suivis_post_insertion ENABLE ROW LEVEL SECURITY;

--
-- Name: suivis_programmes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suivis_programmes ENABLE ROW LEVEL SECURITY;

--
-- Name: abonnements_clients_abc super_admin_access_abonnements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_access_abonnements ON public.abonnements_clients_abc TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: demandes_acces_abc super_admin_access_demandes_abc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_access_demandes_abc ON public.demandes_acces_abc TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: transactions_paiement super_admin_access_paiements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_access_paiements ON public.transactions_paiement TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: instances_saas_pays super_admin_access_saas_pays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_access_saas_pays ON public.instances_saas_pays TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: structures_abc super_admin_access_structures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_access_structures ON public.structures_abc TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: super_admins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

--
-- Name: taches_ia_psychoeduc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.taches_ia_psychoeduc ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions_paiement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions_paiement ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions_wallet; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions_wallet ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions_wallet tx_select_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tx_select_org ON public.transactions_wallet FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: transactions_wallet tx_write_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tx_write_org ON public.transactions_wallet TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: utilisateurs_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.utilisateurs_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: validations_competences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.validations_competences ENABLE ROW LEVEL SECURITY;

--
-- Name: validations_suivi_independant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.validations_suivi_independant ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_fondateur; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_fondateur ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_fondateur wallet_select_fondateur_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_select_fondateur_org ON public.wallet_fondateur FOR SELECT TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: wallet_fondateur wallet_write_fondateur_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_write_fondateur_org ON public.wallet_fondateur TO authenticated USING ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid()))))) WITH CHECK ((public.is_fondateur() OR (organisation_id IN ( SELECT mo.organisation_id
   FROM public.membres_organisations mo
  WHERE (mo.user_id = auth.uid())))));


--
-- Name: webhooks_paiement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhooks_paiement ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 3YtgtHI7w37k4z8jQIr2AzhfV5endrAmEMs008XayhHyYhuLL305aCPqGniXfVT

