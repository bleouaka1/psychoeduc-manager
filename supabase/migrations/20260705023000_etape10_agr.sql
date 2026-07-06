-- Étape 10 — AGR : Activités Génératrices de Revenus (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 12. AGR separe de l'IGA.
-- Migration additive uniquement.

create table if not exists public.activites_agr (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  nom_activite text not null,
  description text,
  secteur text,
  date_debut date not null default current_date,
  date_fin date,
  statut text not null default 'en_cours' check (statut in ('en_cours','suspendue','terminee')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- append-only strict (principe absolu section 2 : tables financieres)
create table if not exists public.revenus_agr (
  id uuid primary key default gen_random_uuid(),
  activite_agr_id uuid not null references public.activites_agr(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  montant numeric not null,
  devise text not null default 'FCFA',
  periode date,
  source text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.charges_agr (
  id uuid primary key default gen_random_uuid(),
  activite_agr_id uuid not null references public.activites_agr(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  montant numeric not null,
  devise text not null default 'FCFA',
  periode date,
  categorie text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.evaluations_agr (
  id uuid primary key default gen_random_uuid(),
  activite_agr_id uuid not null references public.activites_agr(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  date_evaluation date not null default current_date,
  rentabilite text check (rentabilite in ('faible','moyenne','bonne','excellente')),
  commentaire text,
  evalue_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rapports_agr (
  id uuid primary key default gen_random_uuid(),
  activite_agr_id uuid not null references public.activites_agr(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  contenu text,
  periode_debut date,
  periode_fin date,
  redige_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- index
create index if not exists idx_activites_agr_beneficiaire_id on public.activites_agr(beneficiaire_id);
create index if not exists idx_activites_agr_organisation_id on public.activites_agr(organisation_id);
create index if not exists idx_revenus_agr_activite_agr_id on public.revenus_agr(activite_agr_id);
create index if not exists idx_charges_agr_activite_agr_id on public.charges_agr(activite_agr_id);
create index if not exists idx_evaluations_agr_activite_agr_id on public.evaluations_agr(activite_agr_id);
create index if not exists idx_rapports_agr_activite_agr_id on public.rapports_agr(activite_agr_id);

-- triggers
create trigger set_updated_at before update on public.activites_agr for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.evaluations_agr for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rapports_agr for each row execute function public.set_updated_at();

create trigger audit_activites_agr after insert or update or delete on public.activites_agr for each row execute function public.log_audit();
create trigger audit_evaluations_agr after insert or update or delete on public.evaluations_agr for each row execute function public.log_audit();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','activites_agr', true, true, true, true),
  ('fondateur','revenus_agr', true, true, false, false),
  ('fondateur','charges_agr', true, true, false, false),
  ('fondateur','evaluations_agr', true, true, true, true),
  ('fondateur','rapports_agr', true, true, true, true),
  ('administrateur','activites_agr', true, true, true, false),
  ('coordinateur','activites_agr', true, true, true, false),
  ('coordinateur','evaluations_agr', true, true, true, false),
  ('educateur','activites_agr', true, true, true, false),
  ('educateur','revenus_agr', true, true, false, false),
  ('educateur','charges_agr', true, true, false, false),
  ('assistant_social','activites_agr', true, true, true, false),
  ('assistant_social','evaluations_agr', true, true, true, false),
  ('assistant_social','rapports_agr', true, true, true, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.activites_agr enable row level security;
alter table public.revenus_agr enable row level security;
alter table public.charges_agr enable row level security;
alter table public.evaluations_agr enable row level security;
alter table public.rapports_agr enable row level security;

create policy activites_agr_select on public.activites_agr for select using (public.is_fondateur() or public.peut_lire('activites_agr', organisation_id));
create policy activites_agr_insert on public.activites_agr for insert with check (public.is_fondateur() or public.peut_creer('activites_agr', organisation_id));
create policy activites_agr_update on public.activites_agr for update using (public.is_fondateur() or public.peut_modifier('activites_agr', organisation_id));
create policy activites_agr_delete on public.activites_agr for delete using (public.is_fondateur() or public.peut_supprimer('activites_agr', organisation_id));

-- revenus_agr / charges_agr : select + insert uniquement, jamais update/delete (append-only, meme pour le fondateur)
create policy revenus_agr_select on public.revenus_agr for select using (public.is_fondateur() or public.peut_lire('revenus_agr', organisation_id));
create policy revenus_agr_insert on public.revenus_agr for insert with check (public.is_fondateur() or public.peut_creer('revenus_agr', organisation_id));

create policy charges_agr_select on public.charges_agr for select using (public.is_fondateur() or public.peut_lire('charges_agr', organisation_id));
create policy charges_agr_insert on public.charges_agr for insert with check (public.is_fondateur() or public.peut_creer('charges_agr', organisation_id));

create policy evaluations_agr_select on public.evaluations_agr for select using (public.is_fondateur() or public.peut_lire('evaluations_agr', organisation_id));
create policy evaluations_agr_insert on public.evaluations_agr for insert with check (public.is_fondateur() or public.peut_creer('evaluations_agr', organisation_id));
create policy evaluations_agr_update on public.evaluations_agr for update using (public.is_fondateur() or public.peut_modifier('evaluations_agr', organisation_id));
create policy evaluations_agr_delete on public.evaluations_agr for delete using (public.is_fondateur() or public.peut_supprimer('evaluations_agr', organisation_id));

create policy rapports_agr_select on public.rapports_agr for select using (public.is_fondateur() or public.peut_lire('rapports_agr', organisation_id));
create policy rapports_agr_insert on public.rapports_agr for insert with check (public.is_fondateur() or public.peut_creer('rapports_agr', organisation_id));
create policy rapports_agr_update on public.rapports_agr for update using (public.is_fondateur() or public.peut_modifier('rapports_agr', organisation_id));
create policy rapports_agr_delete on public.rapports_agr for delete using (public.is_fondateur() or public.peut_supprimer('rapports_agr', organisation_id));
