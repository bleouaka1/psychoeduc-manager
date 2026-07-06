-- Étape 2 — SaaS commercial (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 4
-- Migration additive uniquement.

-- ============================================================================
-- T1 — licences
-- ============================================================================
create table if not exists public.licences (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  type_licence text not null check (type_licence in ('solo','structure','employeur')),
  statut text not null default 'essai_gratuit' check (statut in ('essai_gratuit','actif','expire','suspendu','archive')),
  modules_autorises text[] not null default '{}',
  limite_utilisateurs int,
  limite_beneficiaires int,
  limite_stockage_mo int,
  date_debut timestamptz not null default now(),
  date_fin timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T5b — quotas_organisations
-- ============================================================================
create table if not exists public.quotas_organisations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  max_utilisateurs int,
  max_beneficiaires int,
  max_stockage_mo int,
  utilisateurs_actuels int not null default 0,
  beneficiaires_actuels int not null default 0,
  stockage_utilise_mo numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T6 — essais_gratuits
-- ============================================================================
create table if not exists public.essais_gratuits (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  date_debut timestamptz not null default now(),
  date_fin timestamptz not null,
  converti boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T2 — auto-création licence d'essai + essai gratuit à la création d'une organisation
-- Repose sur le même contournement RLS par le propriétaire de table que le
-- bootstrap de l'Étape 1 (cf. DECISIONS_LOG.md).
-- ============================================================================
create or replace function public.handle_new_organisation_licence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type_licence text;
begin
  v_type_licence := case
    when new.type_organisation = 'solo' then 'solo'
    when new.type_organisation in ('structure','centre','ong','ecole','association','fondation') then 'structure'
    when new.type_organisation in ('employeur','entreprise') then 'employeur'
    else 'structure'
  end;

  insert into public.licences (organisation_id, type_licence, statut, date_debut, date_fin, created_by)
  values (new.id, v_type_licence, 'essai_gratuit', now(), now() + interval '30 days', new.created_by);

  insert into public.essais_gratuits (organisation_id, date_debut, date_fin, created_at, updated_at)
  values (new.id, now(), now() + interval '30 days', now(), now());

  insert into public.quotas_organisations (organisation_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_organisation_created_licence after insert on public.organisations
  for each row execute function public.handle_new_organisation_licence();

-- ============================================================================
-- T3 — abonnements
-- ============================================================================
create table if not exists public.abonnements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  licence_id uuid not null references public.licences(id) on delete cascade,
  periode text not null check (periode in ('mensuel','annuel')),
  montant numeric not null,
  devise text not null default 'FCFA',
  date_debut timestamptz not null default now(),
  date_fin timestamptz,
  statut text not null default 'actif' check (statut in ('actif','expire','annule')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T8 — codes_promo (table plateforme, pas d'organisation_id)
-- ============================================================================
create table if not exists public.codes_promo (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type_reduction text not null check (type_reduction in ('pourcentage','montant_fixe')),
  valeur numeric not null,
  licences_applicables text[],
  date_debut timestamptz,
  date_fin timestamptz,
  utilisation_max int,
  utilisation_actuelle int not null default 0,
  actif boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T4 — paiements (append-only strict : chaînage par paiement_precedent_id,
-- jamais de mise à jour en place d'un statut). Décision structurante, cf.
-- DECISIONS_LOG.md.
-- ============================================================================
create table if not exists public.paiements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  abonnement_id uuid references public.abonnements(id) on delete set null,
  code_promo_id uuid references public.codes_promo(id) on delete set null,
  montant numeric not null,
  devise text not null default 'FCFA',
  methode_paiement text,
  statut text not null check (statut in ('initie','confirme','echoue','rembourse')),
  reference_externe text,
  paiement_precedent_id uuid references public.paiements(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- T5 — modules_actives
-- ============================================================================
create table if not exists public.modules_actives (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  module text not null,
  actif boolean not null default true,
  active_le timestamptz not null default now(),
  desactive_le timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, module)
);

-- ============================================================================
-- T7 — transactions_wallet (append-only) + wallet_fondateur (vue calculée)
-- ============================================================================
create table if not exists public.transactions_wallet (
  id uuid primary key default gen_random_uuid(),
  organisation_id_source uuid references public.organisations(id) on delete set null,
  type_mouvement text not null check (type_mouvement in ('revenu_abonnement','commission','retrait','ajustement')),
  montant numeric not null,
  devise text not null default 'FCFA',
  reference_source_table text,
  reference_source_id uuid,
  statut text not null default 'confirme' check (statut in ('confirme','annule')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace view public.wallet_fondateur
with (security_invoker = true) as
select coalesce(sum(montant) filter (where statut = 'confirme'), 0)::numeric as solde
from public.transactions_wallet;

-- ============================================================================
-- Seed permissions pour les nouveaux modules (additif, ON CONFLICT DO NOTHING)
-- ============================================================================
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','licences', true, true, true, true),
  ('fondateur','abonnements', true, true, true, true),
  ('fondateur','paiements', true, true, false, false),
  ('fondateur','modules_actives', true, true, true, true),
  ('fondateur','quotas_organisations', true, true, true, false),
  ('fondateur','essais_gratuits', true, true, true, false),
  ('fondateur','codes_promo', true, true, true, true),
  ('fondateur','transactions_wallet', true, true, false, false),
  ('administrateur','licences', true, false, false, false),
  ('administrateur','abonnements', true, false, false, false),
  ('administrateur','paiements', true, true, false, false),
  ('administrateur','modules_actives', true, false, false, false),
  ('administrateur','quotas_organisations', true, false, false, false),
  ('administrateur','essais_gratuits', true, false, false, false),
  ('administrateur','codes_promo', true, false, false, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- Index sur les FK
-- ============================================================================
create index if not exists idx_licences_organisation_id on public.licences(organisation_id);
create index if not exists idx_quotas_organisations_organisation_id on public.quotas_organisations(organisation_id);
create index if not exists idx_essais_gratuits_organisation_id on public.essais_gratuits(organisation_id);
create index if not exists idx_abonnements_organisation_id on public.abonnements(organisation_id);
create index if not exists idx_abonnements_licence_id on public.abonnements(licence_id);
create index if not exists idx_paiements_organisation_id on public.paiements(organisation_id);
create index if not exists idx_paiements_abonnement_id on public.paiements(abonnement_id);
create index if not exists idx_paiements_code_promo_id on public.paiements(code_promo_id);
create index if not exists idx_paiements_precedent_id on public.paiements(paiement_precedent_id);
create index if not exists idx_modules_actives_organisation_id on public.modules_actives(organisation_id);
create index if not exists idx_transactions_wallet_organisation_id_source on public.transactions_wallet(organisation_id_source);

-- ============================================================================
-- Triggers updated_at (tables mutables uniquement — pas sur paiements/transactions_wallet, append-only)
-- ============================================================================
create trigger set_updated_at before update on public.licences
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.quotas_organisations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.essais_gratuits
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.abonnements
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.modules_actives
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.codes_promo
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Triggers d'audit (tables mutables scoping organisation ; pas sur paiements/
-- transactions_wallet, déjà append-only par elles-mêmes, ni sur codes_promo,
-- table plateforme hors périmètre organisation)
-- ============================================================================
create trigger audit_licences after insert or update or delete on public.licences
  for each row execute function public.log_audit();
create trigger audit_abonnements after insert or update or delete on public.abonnements
  for each row execute function public.log_audit();
create trigger audit_modules_actives after insert or update or delete on public.modules_actives
  for each row execute function public.log_audit();

-- ============================================================================
-- T9 — RLS
-- ============================================================================
alter table public.licences enable row level security;
alter table public.quotas_organisations enable row level security;
alter table public.essais_gratuits enable row level security;
alter table public.abonnements enable row level security;
alter table public.paiements enable row level security;
alter table public.modules_actives enable row level security;
alter table public.codes_promo enable row level security;
alter table public.transactions_wallet enable row level security;

-- licences : lecture par les membres de l'organisation ou le fondateur ; écriture réservée au fondateur
create policy licences_select on public.licences
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
create policy licences_write on public.licences
  for all using (public.is_fondateur()) with check (public.is_fondateur());

-- quotas_organisations : lecture membres/fondateur ; écriture fondateur uniquement
create policy quotas_organisations_select on public.quotas_organisations
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
create policy quotas_organisations_write on public.quotas_organisations
  for all using (public.is_fondateur()) with check (public.is_fondateur());

-- essais_gratuits : lecture membres/fondateur ; écriture fondateur uniquement
create policy essais_gratuits_select on public.essais_gratuits
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
create policy essais_gratuits_write on public.essais_gratuits
  for all using (public.is_fondateur()) with check (public.is_fondateur());

-- abonnements : lecture membres/fondateur ; écriture via permission ou fondateur
create policy abonnements_select on public.abonnements
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
create policy abonnements_insert on public.abonnements
  for insert with check (public.is_fondateur() or public.peut_creer('abonnements', organisation_id));
create policy abonnements_update on public.abonnements
  for update using (public.is_fondateur() or public.peut_modifier('abonnements', organisation_id));
create policy abonnements_delete on public.abonnements
  for delete using (public.is_fondateur());

-- paiements : lecture membres/fondateur ; INSERT via permission ou fondateur ; AUCUNE policy UPDATE/DELETE (append-only strict)
create policy paiements_select on public.paiements
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
create policy paiements_insert on public.paiements
  for insert with check (public.is_fondateur() or public.peut_creer('paiements', organisation_id));

-- modules_actives : lecture membres/fondateur ; écriture via permission ou fondateur
create policy modules_actives_select on public.modules_actives
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
create policy modules_actives_write on public.modules_actives
  for all using (public.is_fondateur() or public.peut_modifier('modules_actives', organisation_id))
  with check (public.is_fondateur() or public.peut_creer('modules_actives', organisation_id));

-- codes_promo : lecture ouverte à tout authentifié (validation à la volée), écriture fondateur uniquement
create policy codes_promo_select on public.codes_promo
  for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy codes_promo_write on public.codes_promo
  for all using (public.is_fondateur()) with check (public.is_fondateur());

-- transactions_wallet : réservé au fondateur, en lecture comme en écriture (INSERT seulement, jamais UPDATE/DELETE)
create policy transactions_wallet_select on public.transactions_wallet
  for select using (public.is_fondateur());
create policy transactions_wallet_insert on public.transactions_wallet
  for insert with check (public.is_fondateur());
