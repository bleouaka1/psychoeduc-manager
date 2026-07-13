-- Compte Structure — Finalisation des invitations (§4.4). Deux nouvelles fonctions,
-- même principe que finaliser_acces_beneficiaire (Étape comptes multiprofils) :
-- SECURITY DEFINER car l'utilisateur qui accepte l'invitation n'a par construction
-- encore aucun droit RLS sur les tables qu'il faut lui ouvrir. Portée strictement
-- limitée à la consommation d'un token d'invitation valide, jamais un accès RLS général.
-- Migration additive uniquement.

-- ============================================================================
-- finaliser_acces_membre_equipe : accepte une invitation role_propose IN
-- (directeur/coordinateur/educateur/formateur/promoteur/...), crée l'adhésion +
-- le rôle pour l'utilisateur authentifié courant.
-- ============================================================================
create or replace function public.finaliser_acces_membre_equipe(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation record;
  v_membre_id uuid;
begin
  select * into v_invitation
  from public.invitations_utilisateurs
  where token = p_token
    and statut = 'en_attente'
    and expire_le > now()
    and beneficiaire_id is null; -- distingue d'une invitation bénéficiaire/parent

  if not found then
    return false;
  end if;

  insert into public.membres_organisations (organisation_id, profile_id, etablissement_id, statut, created_by)
  values (v_invitation.organisation_id, auth.uid(), v_invitation.etablissement_id, 'actif', auth.uid())
  on conflict (organisation_id, profile_id) do update set statut = 'actif', etablissement_id = coalesce(public.membres_organisations.etablissement_id, excluded.etablissement_id)
  returning id into v_membre_id;

  insert into public.roles_utilisateurs (membre_organisation_id, role, created_by)
  values (v_membre_id, v_invitation.role_propose, auth.uid())
  on conflict (membre_organisation_id, role) do update set actif = true;

  update public.invitations_utilisateurs
    set statut = 'acceptee', updated_at = now()
    where id = v_invitation.id;

  return true;
end;
$$;

-- ============================================================================
-- finaliser_acces_parent : accepte une invitation role_propose IN ('parent','tuteur')
-- liée à un bénéficiaire précis, crée liens_parent_beneficiaire pour l'utilisateur
-- authentifié courant. Un bénéficiaire peut avoir plusieurs tuteurs (§4.4) : pas de
-- contrainte "un seul lien actif par bénéficiaire", seulement un lien unique par
-- couple (parent, bénéficiaire) — déjà appliqué par la contrainte unique de la table.
-- ============================================================================
create or replace function public.finaliser_acces_parent(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation record;
begin
  select * into v_invitation
  from public.invitations_utilisateurs
  where token = p_token
    and role_propose in ('parent', 'tuteur')
    and statut = 'en_attente'
    and expire_le > now()
    and beneficiaire_id is not null;

  if not found then
    return false;
  end if;

  insert into public.liens_parent_beneficiaire (organisation_id, parent_profile_id, beneficiaire_id, invitation_id, statut)
  values (v_invitation.organisation_id, auth.uid(), v_invitation.beneficiaire_id, v_invitation.id, 'actif')
  on conflict (parent_profile_id, beneficiaire_id) do update set statut = 'actif', revoque_par = null, revoque_at = null;

  update public.invitations_utilisateurs
    set statut = 'acceptee', updated_at = now()
    where id = v_invitation.id;

  return true;
end;
$$;
