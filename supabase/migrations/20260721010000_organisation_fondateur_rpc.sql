-- Résolution de l'organisation Solo du Fondateur — nécessaire pour le repli
-- "Contacter le Fondateur" du mécanisme IGA→Marketplace (§4.1, §5), depuis une
-- page consultée par n'importe quel praticien (RLS de membres_organisations/
-- roles_utilisateurs le restreindrait sinon à sa propre organisation — même
-- contournement volontaire que organisation_est_fondateur()/premier_membre_actif()).
create or replace function public.organisation_fondateur()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select mo.organisation_id
  from public.roles_utilisateurs ru
  join public.membres_organisations mo on mo.id = ru.membre_organisation_id
  where ru.role = 'fondateur' and ru.actif
  order by mo.created_at
  limit 1;
$$;
