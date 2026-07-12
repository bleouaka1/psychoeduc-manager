-- Comptes à profils multiples + Tableau de bord bénéficiaire — Phase 1 (fondations).
-- Réf : CLAUDE-CODE-COMPTES-MULTIPROFILS.md, CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md.
-- Voir PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md pour les décisions détaillées.
-- Migration additive uniquement.

-- ============================================================================
-- T1a — invitations_utilisateurs : extension pour pointer vers une fiche
-- bénéficiaire précise (l'invitation générique Étape 4 ne portait qu'un rôle et
-- une organisation, jamais consommée par du code jusqu'ici — première utilisation
-- réelle de cette table).
-- ============================================================================
alter table public.invitations_utilisateurs
  add column if not exists beneficiaire_id uuid references public.beneficiaires(id) on delete cascade;

create index if not exists idx_invitations_utilisateurs_beneficiaire_id on public.invitations_utilisateurs(beneficiaire_id);

-- ============================================================================
-- T1b — projets_vie : un bénéficiaire peut avoir plusieurs projets de vie actifs
-- en parallèle (le document l'exige explicitement) ; la contrainte 1:1 posée à
-- l'Étape 7 n'a jamais été consommée par aucun code, aucune ligne existante donc
-- aucun risque de perte de données en la retirant.
-- ============================================================================
alter table public.projets_vie drop constraint if exists projets_vie_beneficiaire_id_key;
create index if not exists idx_projets_vie_beneficiaire_id on public.projets_vie(beneficiaire_id);

-- ============================================================================
-- T2 — finaliser_acces_beneficiaire : lie un profil fraîchement authentifié à sa
-- fiche bénéficiaire via le token d'invitation. SECURITY DEFINER nécessaire :
-- beneficiaires_update exige peut_modifier(organisation_id), qu'un bénéficiaire
-- (qui n'est jamais membre de l'organisation) ne peut structurellement jamais
-- satisfaire — même principe que les autres fonctions de bootstrap du projet
-- (handle_new_organisation, etc.), portée strictement limitée à cette seule
-- opération de liaison, jamais un accès RLS général.
-- ============================================================================
create or replace function public.finaliser_acces_beneficiaire(p_token text)
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
    and role_propose = 'beneficiaire'
    and statut = 'en_attente'
    and expire_le > now()
    and beneficiaire_id is not null;

  if not found then
    return false;
  end if;

  update public.beneficiaires
    set profile_id = auth.uid()
    where id = v_invitation.beneficiaire_id and profile_id is null;

  if not found then
    return false; -- déjà rattaché à un autre profil, ou fiche introuvable : jamais d'écrasement silencieux
  end if;

  update public.invitations_utilisateurs
    set statut = 'acceptee', updated_at = now()
    where id = v_invitation.id;

  return true;
end;
$$;
