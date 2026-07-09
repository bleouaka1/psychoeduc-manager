-- Correctif : peuventDemarrerConversation() (lib/messagerieInterne.ts) tentait de
-- vérifier si un profil cible est membre de l'organisation du Fondateur via une
-- lecture directe de `membres_organisations` — bloquée par RLS dès que l'appelant
-- n'est pas lui-même membre de CETTE organisation (un compte Solo ne peut jamais
-- lire la liste des membres de l'organisation du Fondateur). Même classe de bug
-- que celle déjà résolue par organisation_est_fondateur()/premier_membre_actif().
create or replace function public.profil_est_fondateur(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.roles_utilisateurs ru
    join public.membres_organisations mo on mo.id = ru.membre_organisation_id
    where mo.profile_id = p_profile_id and ru.role = 'fondateur' and ru.actif
  );
$$;
