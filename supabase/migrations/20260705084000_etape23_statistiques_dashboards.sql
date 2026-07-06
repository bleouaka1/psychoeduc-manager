-- Étape 23 — Statistiques mondiales & dashboards (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 25
-- Enrichit vue_dashboard_fondateur (creee a "18 light") de facon additive :
-- les 6 colonnes existantes restent en tete, dans le meme ordre (CREATE OR REPLACE
-- VIEW ne permet pas de retirer/reordonner des colonnes existantes).
-- Migration additive uniquement.

create or replace view public.vue_dashboard_fondateur
with (security_invoker = true) as
select
  (select count(*) from public.organisations) as total_organisations,
  (select count(*) from public.beneficiaires) as total_beneficiaires,
  (select count(*) from public.evaluations_iga) as total_evaluations_iga,
  (select round(avg(score_global), 1) from public.evaluations_iga where score_global is not null) as score_iga_moyen,
  (select count(*) from public.licences where statut = 'actif') as licences_actives,
  (select count(*) from public.essais_gratuits where converti = false and date_fin >= current_date) as essais_gratuits_en_cours,
  (select count(*) from public.organisations where type_organisation = 'solo') as total_solo,
  (select count(*) from public.organisations where type_organisation in ('structure','centre','ong','ecole','association','fondation')) as total_structures,
  (select count(*) from public.organisations where type_organisation in ('employeur','entreprise')) as total_employeurs,
  (select count(*) from public.personnel_structures) as total_personnel,
  (select coalesce(sum(montant), 0) from public.paiements where statut = 'confirme') as revenus_confirmes_total,
  (select count(*) from public.reussites_beneficiaires where statut = 'confirmee') as total_reussites_confirmees;

-- vue_dashboard_modules : organisations actives par module
create or replace view public.vue_dashboard_modules
with (security_invoker = true) as
select module, count(*) as nb_organisations_actives
from public.modules_actives
where actif = true
group by module;

-- vue_carte_implantation : implantations par pays/ville
create or replace view public.vue_carte_implantation
with (security_invoker = true) as
select pays, ville, count(distinct organisation_id) as nb_organisations
from public.implantations
group by pays, ville;

-- vue_revenus : paiements confirmes agreges par mois
create or replace view public.vue_revenus
with (security_invoker = true) as
select date_trunc('month', created_at) as mois, sum(montant) as total_confirme
from public.paiements
where statut = 'confirme'
group by date_trunc('month', created_at)
order by mois;

-- vue_top100_iga : alias exact du nom du document sur top100_iga (Etape 9), pas de duplication de logique
create or replace view public.vue_top100_iga
with (security_invoker = true) as
select * from public.top100_iga;

-- vue_insertion : insertions par statut / type
create or replace view public.vue_insertion
with (security_invoker = true) as
select statut, type_insertion, count(*) as total
from public.insertions_professionnelles
group by statut, type_insertion;

-- vue_support : tickets par statut / priorite
create or replace view public.vue_support
with (security_invoker = true) as
select statut, priorite, count(*) as total
from public.tickets_support
group by statut, priorite;

-- vue_reussites : uniquement les reussites CONFIRMEES (pas de gonflement artificiel des chiffres)
create or replace view public.vue_reussites
with (security_invoker = true) as
select * from public.reussites_beneficiaires where statut = 'confirmee';

-- vue_marketplace : etat des offres + commission confirmee totale
create or replace view public.vue_marketplace
with (security_invoker = true) as
select
  count(*) filter (where statut = 'publiee') as offres_publiees,
  count(*) filter (where statut = 'en_attente_validation') as offres_en_attente,
  count(*) filter (where statut = 'masquee') as offres_masquees,
  (select coalesce(sum(montant_commission), 0) from public.marketplace_commandes where statut_paiement = 'confirme') as commission_totale_confirmee
from public.marketplace_offres;

-- statistiques_plateforme : snapshots periodiques (alimentee par une tache future, pas de valeur inventee ici)
create table if not exists public.statistiques_plateforme (
  id uuid primary key default gen_random_uuid(),
  cle text not null,
  valeur jsonb not null,
  calcule_le timestamptz not null default now()
);

create index if not exists idx_statistiques_plateforme_cle on public.statistiques_plateforme(cle);

-- configurations_dashboard : preferences d'affichage par utilisateur
create table if not exists public.configurations_dashboard (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  valeur jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.configurations_dashboard for each row execute function public.set_updated_at();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','statistiques_plateforme', true, true, true, true),
  ('administrateur','statistiques_plateforme', true, false, false, false)
on conflict (role, module) do nothing;

-- RLS (tables uniquement -- les vues heritent de security_invoker, pas de RLS propre)
alter table public.statistiques_plateforme enable row level security;
alter table public.configurations_dashboard enable row level security;

create policy statistiques_plateforme_select on public.statistiques_plateforme
  for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy statistiques_plateforme_write on public.statistiques_plateforme
  for all using (public.is_fondateur()) with check (public.is_fondateur());

create policy configurations_dashboard_select on public.configurations_dashboard
  for select using (public.is_fondateur() or profile_id = auth.uid());
create policy configurations_dashboard_insert on public.configurations_dashboard
  for insert with check (public.is_fondateur() or profile_id = auth.uid());
create policy configurations_dashboard_update on public.configurations_dashboard
  for update using (public.is_fondateur() or profile_id = auth.uid());
