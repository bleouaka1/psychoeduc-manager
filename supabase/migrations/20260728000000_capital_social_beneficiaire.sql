-- Tableau de bord bénéficiaire — Phase 5 : Capital social (bénéficiaire-facing).
-- Réf : CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md §7.
-- Collision de nom évitée : le module Étape 11 (evaluations_capital_social,
-- reseau_soutien, page /capital-social) reste une vue praticien d'un score évalué
-- manuellement — sans rapport avec ce réseau de relations confirmées mutuellement.
-- Migration additive uniquement.

create table if not exists public.relations_capital_social (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type_relation text not null check (type_relation in ('formateur_educateur', 'beneficiaire', 'employeur', 'structure')),
  contact_profile_id uuid references public.profiles(id),
  contact_beneficiaire_id uuid references public.beneficiaires(id) on delete cascade,
  contexte text,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'confirmee', 'refusee')),
  demande_par_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (type_relation = 'beneficiaire' and contact_beneficiaire_id is not null and contact_profile_id is null)
    or (type_relation <> 'beneficiaire' and contact_profile_id is not null and contact_beneficiaire_id is null)
  )
);

create index if not exists idx_relations_capital_social_beneficiaire_id on public.relations_capital_social(beneficiaire_id);
create index if not exists idx_relations_capital_social_contact_beneficiaire_id on public.relations_capital_social(contact_beneficiaire_id);

create trigger set_updated_at before update on public.relations_capital_social for each row execute function public.set_updated_at();
create trigger audit_relations_capital_social after insert or update or delete on public.relations_capital_social for each row execute function public.log_audit();

alter table public.relations_capital_social enable row level security;

-- Les deux côtés d'une relation la voient (le bénéficiaire propriétaire de la ligne,
-- et le bénéficiaire cible pour le type 'beneficiaire') ; le praticien voit celles
-- de son organisation. Le contact staff/employeur (contact_profile_id) la voit aussi
-- directement par son propre profil, sans dépendre de peut_lire.
create policy relations_capital_social_select on public.relations_capital_social for select using (
  public.is_fondateur()
  or public.peut_lire('relations_capital_social', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = relations_capital_social.beneficiaire_id and b.profile_id = auth.uid())
  or exists (select 1 from public.beneficiaires b where b.id = relations_capital_social.contact_beneficiaire_id and b.profile_id = auth.uid())
  or contact_profile_id = auth.uid()
);

-- Le bénéficiaire propose lui-même une relation (self-service, levier "Autonomie").
create policy relations_capital_social_insert on public.relations_capital_social for insert with check (
  public.is_fondateur()
  or public.peut_creer('relations_capital_social', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = relations_capital_social.beneficiaire_id and b.profile_id = auth.uid())
);

-- Confirmation mutuelle : le bénéficiaire cible, ou le contact staff/employeur,
-- peut passer 'en_attente' -> 'confirmee'/'refusee', jamais un tiers.
create policy relations_capital_social_update on public.relations_capital_social for update using (
  public.is_fondateur()
  or public.peut_modifier('relations_capital_social', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = relations_capital_social.beneficiaire_id and b.profile_id = auth.uid())
  or exists (select 1 from public.beneficiaires b where b.id = relations_capital_social.contact_beneficiaire_id and b.profile_id = auth.uid())
  or contact_profile_id = auth.uid()
);

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','relations_capital_social', true, true, true, true),
  ('administrateur','relations_capital_social', true, true, true, false),
  ('educateur','relations_capital_social', true, true, true, false),
  ('psychologue','relations_capital_social', true, true, true, false),
  ('coordinateur','relations_capital_social', true, true, true, false)
on conflict (role, module) do nothing;
