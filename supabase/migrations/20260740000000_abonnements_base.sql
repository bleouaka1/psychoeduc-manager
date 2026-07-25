-- Dashboard bénéficiaire v3, Lot H — Abonnement de base (200 FCFA/mois) : débloque le
-- moteur de quiz sans IA (jusqu'ici gratuit à vie sans condition). Renversement de
-- politique commerciale confirmé explicitement par Angenor le 2026-07-25 avant cette
-- migration (cf. PLAN_DASHBOARD_BENEFICIAIRE_V3.md). Multi-payeur, même schéma que
-- credits_transactions (payeur_type/payeur_id) — jamais bloquer un bénéficiaire sans
-- solution de prise en charge visible par un tiers (§11 du handoff).
create table if not exists public.abonnements_base (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  type_formule text not null default 'base' check (type_formule in ('base', 'pack_2_matieres', 'tout_inclus')),
  payeur_type text not null check (payeur_type in ('beneficiaire', 'parent', 'structure')),
  payeur_id uuid not null references public.profiles(id),
  statut text not null check (statut in ('actif', 'expire', 'annule')),
  periode_debut timestamptz not null,
  periode_fin timestamptz not null,
  montant_paye numeric not null,
  devise text not null default 'XOF',
  moyen_paiement text,
  transaction_ref text,
  mouvement_financier_id uuid references public.mouvements_financiers(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_abonnements_base_beneficiaire_id on public.abonnements_base(beneficiaire_id);

alter table public.abonnements_base enable row level security;

-- Lecture : bénéficiaire propriétaire + équipe pédagogique (transparence des
-- abonnements offerts par la structure), jamais un autre bénéficiaire.
create policy abonnements_base_select on public.abonnements_base for select using (
  public.is_fondateur()
  or public.peut_lire('abonnements_base', (select organisation_id from public.beneficiaires where id = abonnements_base.beneficiaire_id))
  or exists (select 1 from public.beneficiaires b where b.id = abonnements_base.beneficiaire_id and b.profile_id = auth.uid())
);

-- Écriture uniquement via fonction serveur (jamais un insert direct côté client),
-- même principe que credits_revision/credits_transactions.
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur', 'abonnements_base', true, false, false, false),
  ('directeur', 'abonnements_base', true, false, false, false),
  ('promoteur', 'abonnements_base', true, false, false, false),
  ('coordinateur', 'abonnements_base', true, false, false, false),
  ('educateur', 'abonnements_base', true, false, false, false),
  ('formateur', 'abonnements_base', true, false, false, false),
  ('administrateur', 'abonnements_base', true, false, false, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- Confirmation du paiement — jamais avant confirmation réelle du prestataire (même
-- garde-fou que confirmer_transaction_credits/confirmer_paiement_cv). Crée ou
-- prolonge la période active ; SECURITY DEFINER, révoquée de PUBLIC, réservée au
-- futur webhook (clé service_role).
-- ============================================================================
create or replace function public.confirmer_abonnement_base(
  p_beneficiaire_id uuid,
  p_type_formule text,
  p_payeur_type text,
  p_payeur_id uuid,
  p_montant_paye numeric,
  p_devise text,
  p_duree_jours int default 30
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.abonnements_base (beneficiaire_id, type_formule, payeur_type, payeur_id, statut, periode_debut, periode_fin, montant_paye, devise)
  values (p_beneficiaire_id, p_type_formule, p_payeur_type, p_payeur_id, 'actif', now(), now() + (p_duree_jours || ' days')::interval, p_montant_paye, p_devise)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.confirmer_abonnement_base(uuid, text, text, uuid, numeric, text, int) from public;
