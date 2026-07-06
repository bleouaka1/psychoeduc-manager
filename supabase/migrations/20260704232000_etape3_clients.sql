-- Étape 3 — Clients : Solo, Structures, Employeurs (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 5
-- Migration additive uniquement. Pas de table comptes_solo séparée (interdit par le document).

-- ============================================================================
-- T1 — details_structures (1:1 avec organisations)
-- ============================================================================
create table if not exists public.details_structures (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  secteur_activite text,
  numero_agrement text,
  date_agrement date,
  responsable_nom text,
  responsable_fonction text,
  site_web text,
  description text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T2 — details_employeurs (1:1 avec organisations)
-- ============================================================================
create table if not exists public.details_employeurs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  secteur_activite text,
  taille_entreprise text check (taille_entreprise in ('tpe','pme','grande_entreprise')),
  numero_registre_commerce text,
  site_web text,
  description text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T3 — implantations (1:N : une organisation peut avoir plusieurs sites)
-- ============================================================================
create table if not exists public.implantations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  pays text,
  ville text,
  adresse text,
  quartier text,
  latitude numeric,
  longitude numeric,
  est_siege boolean not null default false,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- au plus un siège par organisation
create unique index if not exists idx_implantations_un_seul_siege
  on public.implantations(organisation_id)
  where (est_siege = true);

-- ============================================================================
-- T4 — index, triggers, seed permissions
-- ============================================================================
create index if not exists idx_details_structures_organisation_id on public.details_structures(organisation_id);
create index if not exists idx_details_employeurs_organisation_id on public.details_employeurs(organisation_id);
create index if not exists idx_implantations_organisation_id on public.implantations(organisation_id);

create trigger set_updated_at before update on public.details_structures
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.details_employeurs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.implantations
  for each row execute function public.set_updated_at();

create trigger audit_details_structures after insert or update or delete on public.details_structures
  for each row execute function public.log_audit();
create trigger audit_details_employeurs after insert or update or delete on public.details_employeurs
  for each row execute function public.log_audit();
create trigger audit_implantations after insert or update or delete on public.implantations
  for each row execute function public.log_audit();

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','details_structures', true, true, true, true),
  ('fondateur','details_employeurs', true, true, true, true),
  ('fondateur','implantations', true, true, true, true),
  ('administrateur','details_structures', true, true, true, false),
  ('administrateur','details_employeurs', true, true, true, false),
  ('administrateur','implantations', true, true, true, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.details_structures enable row level security;
alter table public.details_employeurs enable row level security;
alter table public.implantations enable row level security;

create policy details_structures_select on public.details_structures
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
create policy details_structures_insert on public.details_structures
  for insert with check (public.is_fondateur() or public.peut_creer('details_structures', organisation_id));
create policy details_structures_update on public.details_structures
  for update using (public.is_fondateur() or public.peut_modifier('details_structures', organisation_id));
create policy details_structures_delete on public.details_structures
  for delete using (public.is_fondateur() or public.peut_supprimer('details_structures', organisation_id));

create policy details_employeurs_select on public.details_employeurs
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
create policy details_employeurs_insert on public.details_employeurs
  for insert with check (public.is_fondateur() or public.peut_creer('details_employeurs', organisation_id));
create policy details_employeurs_update on public.details_employeurs
  for update using (public.is_fondateur() or public.peut_modifier('details_employeurs', organisation_id));
create policy details_employeurs_delete on public.details_employeurs
  for delete using (public.is_fondateur() or public.peut_supprimer('details_employeurs', organisation_id));

create policy implantations_select on public.implantations
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
create policy implantations_insert on public.implantations
  for insert with check (public.is_fondateur() or public.peut_creer('implantations', organisation_id));
create policy implantations_update on public.implantations
  for update using (public.is_fondateur() or public.peut_modifier('implantations', organisation_id));
create policy implantations_delete on public.implantations
  for delete using (public.is_fondateur() or public.peut_supprimer('implantations', organisation_id));
