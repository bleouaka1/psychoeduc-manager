-- Compte Structure — §4.4, mécanisme d'invitation unifié (équipe + parent). Généralise
-- consulter_invitation_beneficiaire (session comptes multiprofils) au lieu de la dupliquer :
-- même principe (SECURITY DEFINER, lecture publique minimale par token, jamais la ligne
-- complète), étendu à role_propose quelconque plutôt que 'beneficiaire' uniquement.
-- Migration additive uniquement.
create or replace function public.consulter_invitation(p_token text)
returns table(email text, role_propose text, organisation_nom text, beneficiaire_nom text, valide boolean)
language sql
security definer
set search_path = public
as $$
  select
    i.email,
    i.role_propose,
    o.nom as organisation_nom,
    b.prenoms as beneficiaire_nom,
    (i.statut = 'en_attente' and i.expire_le > now()) as valide
  from public.invitations_utilisateurs i
  join public.organisations o on o.id = i.organisation_id
  left join public.beneficiaires b on b.id = i.beneficiaire_id
  where i.token = p_token;
$$;

grant execute on function public.consulter_invitation(text) to anon, authenticated;
