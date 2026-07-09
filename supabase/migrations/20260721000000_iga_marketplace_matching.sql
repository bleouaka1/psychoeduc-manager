-- Mécanisme IGA → Marketplace : spécialités par dimension IGA + IPP (Indice de
-- Performance du Praticien). Réf : PLAN_IGA_MARKETPLACE_MATCHING.md,
-- IGA_Mecanisme_Marketplace.md. Migration additive uniquement.

-- ============================================================================
-- T1 — Spécialités déclarées par dimension IGA (matching précis, en plus du
-- champ texte libre `specialites` déjà existant pour l'affichage humain).
-- ============================================================================
alter table public.profils_publics_formateurs
  add column if not exists specialites_dimensions_iga text[] not null default '{}';

-- ============================================================================
-- T2 — IPP en registre append-only (même principe que l'argent, Étape 2/15) :
-- jamais de score modifiable en place, jamais par simple déclaration (§6.2 du
-- document source). Écriture réservée au Fondateur — seul rôle qui "vérifie"
-- un témoignage/résultat au sens du document.
-- ============================================================================
create table if not exists public.evenements_ipp (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type_evenement text not null check (type_evenement in ('formation_continue', 'resultat_verifie', 'temoignage_verifie')),
  delta numeric not null,
  motif text,
  beneficiaire_id uuid references public.beneficiaires(id) on delete set null,
  verifie_par uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_evenements_ipp_organisation_id on public.evenements_ipp(organisation_id);

create trigger audit_evenements_ipp after insert or update or delete on public.evenements_ipp
  for each row execute function public.log_audit();

alter table public.evenements_ipp enable row level security;

-- Lecture ouverte : l'IPP est un score de confiance public (classement marketplace),
-- pas une donnée sensible individuelle.
create policy evenements_ipp_select on public.evenements_ipp for select using (true);
create policy evenements_ipp_insert on public.evenements_ipp
  for insert with check (public.is_fondateur() and verifie_par = auth.uid());
-- Aucune policy update/delete : append-only strict, y compris pour le fondateur (même
-- principe que audit_logs, Étape 1).

-- Vue plutôt que table dupliquée (principe déjà appliqué à vue_satisfaction_vendeur,
-- IgaDial, etc.) : le score courant est TOUJOURS recalculé depuis le registre,
-- jamais stocké en dur. Baseline neutre à 50/100 pour tout praticien sans historique.
create or replace view public.vue_ipp
with (security_invoker = true) as
select
  o.id as organisation_id,
  50 + coalesce(sum(e.delta), 0) as score,
  count(e.id) as nombre_evenements_verifies
from public.organisations o
left join public.evenements_ipp e on e.organisation_id = o.id
group by o.id;
