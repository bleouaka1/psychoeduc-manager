-- Consultation publique (anonyme) d'une invitation bénéficiaire par token, pour la
-- page /inscription-beneficiaire — un visiteur qui suit ce lien n'est pas encore
-- authentifié, donc pas encore membre de l'organisation (invitations_utilisateurs_select
-- l'exige) : SECURITY DEFINER limité à un jeu de colonnes minimal, jamais la ligne
-- complète. Migration additive uniquement.

create or replace function public.consulter_invitation_beneficiaire(p_token text)
returns table(email text, prenom text, valide boolean)
language sql
security definer
set search_path = public
as $$
  select
    i.email,
    b.prenoms as prenom,
    (i.statut = 'en_attente' and i.expire_le > now()) as valide
  from public.invitations_utilisateurs i
  join public.beneficiaires b on b.id = i.beneficiaire_id
  where i.token = p_token and i.role_propose = 'beneficiaire';
$$;

grant execute on function public.consulter_invitation_beneficiaire(text) to anon, authenticated;
