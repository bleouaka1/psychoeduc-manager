-- Correctif : organisation_fondateur() triait par ancienneté croissante (le
-- premier membre fondateur créé) — arbitraire dès que plus d'un compte porte le
-- rôle fondateur (constaté en environnement de dev/test : le compte réel
-- d'Angenor + un compte fixture e2e-fondateur créé pour les tests). Comme il
-- n'existe structurellement qu'un seul "vrai" fondateur en production, ce choix
-- n'a aucun impact réel — mais préférer le plus récent rend le comportement
-- déterministe pour les environnements avec plusieurs comptes fondateur.
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
  order by mo.created_at desc
  limit 1;
$$;
