-- Étape 15 — Registre financier append-only (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 17
-- Construite avant l'Étape 14 (réordonnancement, cf. DECISIONS_LOG.md) car
-- wallets_beneficiaires (Étape 14) doit être une vue calculée dessus.
-- Migration additive uniquement.

create table if not exists public.mouvements_financiers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  beneficiaire_id uuid references public.beneficiaires(id) on delete cascade,
  type_mouvement text,
  montant numeric not null,
  devise text not null default 'FCFA',
  reference_source_table text,
  reference_source_id uuid,
  statut text not null default 'confirme' check (statut in ('confirme','annule')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_mouvements_financiers_organisation_id on public.mouvements_financiers(organisation_id);
create index if not exists idx_mouvements_financiers_beneficiaire_id on public.mouvements_financiers(beneficiaire_id);
create index if not exists idx_mouvements_financiers_reference on public.mouvements_financiers(reference_source_table, reference_source_id);

-- Reconciliation avec transactions_wallet (Etape 2) : wallet_fondateur somme desormais
-- les deux registres. transactions_wallet devient un registre historique gele (plus jamais
-- alimente), mouvements_financiers est la source de verite pour toute nouvelle ecriture.
create or replace view public.wallet_fondateur
with (security_invoker = true) as
select coalesce((
  select sum(montant) from public.transactions_wallet where statut = 'confirme'
), 0) + coalesce((
  select sum(montant) from public.mouvements_financiers
  where statut = 'confirme' and organisation_id is null and beneficiaire_id is null
), 0) as solde;

-- RLS : append-only strict, aucune policy UPDATE/DELETE pour personne, y compris le fondateur
alter table public.mouvements_financiers enable row level security;

create policy mouvements_financiers_select on public.mouvements_financiers
  for select using (
    public.is_fondateur()
    or (organisation_id is not null and public.peut_lire('mouvements_financiers', organisation_id))
  );

create policy mouvements_financiers_insert on public.mouvements_financiers
  for insert with check (
    public.is_fondateur()
    or (organisation_id is not null and public.peut_creer('mouvements_financiers', organisation_id))
  );

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','mouvements_financiers', true, true, false, false),
  ('administrateur','mouvements_financiers', true, true, false, false)
on conflict (role, module) do nothing;
