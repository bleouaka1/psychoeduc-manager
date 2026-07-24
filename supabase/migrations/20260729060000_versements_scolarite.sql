-- Compte Structure — Module Gestion Administrative (§4.1.3, étape 8/10, sous-module Paiements).
-- `paiements_scolarite.montant_paye` (étape 1/10) est une colonne unique mise à jour en place —
-- ne respecte pas à elle seule le principe absolu "argent en registre append-only" (architecture
-- v5 §2). Plutôt que de rouvrir le schéma déjà commité de `paiements_scolarite`, cette migration
-- ajoute `versements_scolarite` (append-only strict, aucune policy update/delete) comme registre
-- de la vérité : chaque versement reçu est une nouvelle ligne, jamais une modification. Un trigger
-- recalcule `montant_paye`/`statut` sur `paiements_scolarite` comme simple cache dérivé — même
-- principe que `wallet_fondateur` (vue calculée depuis `transactions_wallet`, étape 2), adapté ici
-- en cache+trigger plutôt qu'en vue pure car `paiements_scolarite.montant_paye` existe déjà comme
-- colonne stockée et consommée ailleurs (RLS, futurs rapports).
-- Migration additive uniquement.

create table if not exists public.versements_scolarite (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  paiement_id uuid not null references public.paiements_scolarite(id) on delete cascade,
  montant numeric not null check (montant > 0),
  methode text,
  reference text,
  date_versement date not null default current_date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_versements_scolarite_paiement_id on public.versements_scolarite(paiement_id);
create index if not exists idx_versements_scolarite_organisation_id on public.versements_scolarite(organisation_id);

alter table public.versements_scolarite enable row level security;

-- Mêmes droits que paiements_scolarite (directeur/promoteur uniquement, données financières) —
-- aucune nouvelle ligne `permissions` nécessaire, réutilise peut_lire/peut_creer('paiements_scolarite', ...)
-- déjà posés à l'étape 1/10. Aucune policy update/delete : append-only strict.
create policy versements_scolarite_select on public.versements_scolarite
  for select using (public.is_fondateur() or public.peut_lire('paiements_scolarite', organisation_id));
create policy versements_scolarite_insert on public.versements_scolarite
  for insert with check (public.is_fondateur() or public.peut_creer('paiements_scolarite', organisation_id));

create or replace function public.recalculer_paiement_scolarite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_du numeric;
begin
  select coalesce(sum(montant), 0) into v_total from public.versements_scolarite where paiement_id = new.paiement_id;
  select montant_du into v_du from public.paiements_scolarite where id = new.paiement_id;

  update public.paiements_scolarite
    set montant_paye = v_total,
        statut = case when v_total >= v_du then 'a_jour' when v_total > 0 then 'partiel' else 'retard' end,
        updated_at = now()
    where id = new.paiement_id;

  return new;
end;
$$;

create trigger recalculer_paiement_apres_versement
  after insert on public.versements_scolarite
  for each row execute function public.recalculer_paiement_scolarite();
