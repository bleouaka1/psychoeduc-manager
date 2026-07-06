-- Étape 3/3 (UI) : la page détail d'une offre formation doit pouvoir afficher le
-- programme (cours) d'une formation publiée à n'importe quel visiteur authentifié —
-- exactement le même principe que `formations_select_publique` (Étape "compte_solo_formations"),
-- qui n'avait jamais été répliqué sur `cours`. Sans cette policy, `cours_select`
-- (Étape 8, scopée au staff de l'organisation) renvoie 0 ligne pour un acheteur.
-- Policy additionnelle, combinée en OR avec l'existante.
drop policy if exists cours_select_publique on public.cours;
create policy cours_select_publique on public.cours
  for select using (
    exists (select 1 from public.formations f where f.id = cours.formation_id and f.statut = 'publiee')
  );

-- ============================================================================
-- Fonction SECURITY DEFINER pour vérifier si une organisation a un membre
-- 'fondateur' actif, utilisable par n'importe quel visiteur du profil public
-- (contourne volontairement le RLS de membres_organisations/roles_utilisateurs,
-- qui restreint la lecture aux membres de CETTE organisation — un visiteur externe
-- ne doit pas avoir besoin d'en être membre pour voir un simple badge "FONDATEUR").
-- Même principe déjà appliqué à is_fondateur()/peut_lire() dans ce projet.
-- ============================================================================
create or replace function public.organisation_est_fondateur(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.roles_utilisateurs ru
    join public.membres_organisations mo on mo.id = ru.membre_organisation_id
    where mo.organisation_id = p_organisation_id and ru.role = 'fondateur' and ru.actif
  );
$$;

-- ============================================================================
-- Contacter un formateur depuis son profil public : il faut résoudre le profil
-- destinataire (premier membre actif de l'organisation) sans exposer toute la
-- table membres_organisations à un visiteur externe qui n'en est pas membre —
-- même contournement RLS volontaire que ci-dessus, restreint à un seul UUID.
-- ============================================================================
create or replace function public.premier_membre_actif(p_organisation_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profile_id from public.membres_organisations
  where organisation_id = p_organisation_id and statut = 'actif'
  order by created_at
  limit 1;
$$;
