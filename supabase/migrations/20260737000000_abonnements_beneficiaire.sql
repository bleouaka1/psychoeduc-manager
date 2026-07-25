-- Dashboard bénéficiaire v2, Lot E — Abonnement bénéficiaire : schéma minimal, AUCUN
-- paiement récurrent réel (cf. PLAN_DASHBOARD_BENEFICIAIRE_V2.md, écart 3). Distinct de
-- `abonnements`/`licences` (niveau organisation, Solo/Structure/Employeur) — un
-- bénéficiaire individuel n'a aujourd'hui aucun équivalent, ce lot pose juste la
-- structure pour qu'une page de statut affiche une valeur réelle plutôt que fictive.
create table if not exists public.abonnements_beneficiaire (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  formule text not null,
  statut text not null default 'actif' check (statut in ('actif', 'expire', 'suspendu')),
  date_debut date not null default current_date,
  date_fin date,
  renouvellement_auto boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_abonnements_beneficiaire_beneficiaire_id on public.abonnements_beneficiaire(beneficiaire_id);

alter table public.abonnements_beneficiaire enable row level security;

create policy abonnements_beneficiaire_select on public.abonnements_beneficiaire for select using (
  public.is_fondateur()
  or exists (select 1 from public.beneficiaires b where b.id = abonnements_beneficiaire.beneficiaire_id and b.profile_id = auth.uid())
);

-- Écriture réservée au Fondateur : aucun flux d'achat/renouvellement automatique
-- n'existe tant qu'aucun prestataire de paiement n'est configuré (même garde-fou que
-- demarrerGenerationCv/genererQuizPayant).
create policy abonnements_beneficiaire_insert on public.abonnements_beneficiaire for insert with check (public.is_fondateur());
create policy abonnements_beneficiaire_update on public.abonnements_beneficiaire for update using (public.is_fondateur());
