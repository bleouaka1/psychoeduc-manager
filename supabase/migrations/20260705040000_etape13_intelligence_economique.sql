-- Étape 13 — Intelligence économique (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 15
-- organisation_id nullable : null = ressource globale (fondateur), sinon organisation-scopee.
-- Migration additive uniquement.

create table if not exists public.opportunites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  titre text not null,
  description text,
  type_opportunite text,
  secteur text,
  date_publication date not null default current_date,
  date_expiration date,
  url_lien text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.concours (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  titre text not null,
  description text,
  organisateur text,
  date_limite_inscription date,
  url_lien text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bourses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  titre text not null,
  description text,
  organisme text,
  montant text,
  date_limite date,
  url_lien text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  titre text not null,
  description text,
  organisme text,
  montant_max numeric,
  conditions text,
  url_lien text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metiers_porteurs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  nom_metier text not null,
  secteur text,
  description text,
  niveau_demande text check (niveau_demande in ('faible','moyen','eleve')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analyses_marche (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  titre text not null,
  contenu text,
  secteur text,
  date_publication date not null default current_date,
  redige_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- index
create index if not exists idx_opportunites_organisation_id on public.opportunites(organisation_id);
create index if not exists idx_concours_organisation_id on public.concours(organisation_id);
create index if not exists idx_bourses_organisation_id on public.bourses(organisation_id);
create index if not exists idx_financements_organisation_id on public.financements(organisation_id);
create index if not exists idx_metiers_porteurs_organisation_id on public.metiers_porteurs(organisation_id);
create index if not exists idx_analyses_marche_organisation_id on public.analyses_marche(organisation_id);

-- triggers
create trigger set_updated_at before update on public.opportunites for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.concours for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.bourses for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.financements for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.metiers_porteurs for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.analyses_marche for each row execute function public.set_updated_at();

-- seed permissions (module organisation-scope ; les ressources globales passent par is_fondateur() directement)
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','opportunites', true, true, true, true),
  ('fondateur','concours', true, true, true, true),
  ('fondateur','bourses', true, true, true, true),
  ('fondateur','financements', true, true, true, true),
  ('fondateur','metiers_porteurs', true, true, true, true),
  ('fondateur','analyses_marche', true, true, true, true),
  ('administrateur','opportunites', true, true, true, false),
  ('coordinateur','opportunites', true, true, true, false),
  ('coordinateur','concours', true, true, true, false),
  ('coordinateur','bourses', true, true, true, false),
  ('educateur','opportunites', true, false, false, false),
  ('assistant_social','opportunites', true, false, false, false)
on conflict (role, module) do nothing;

-- RLS : lecture = fondateur OU ressource globale (organisation_id null) OU peut_lire scope organisation
alter table public.opportunites enable row level security;
alter table public.concours enable row level security;
alter table public.bourses enable row level security;
alter table public.financements enable row level security;
alter table public.metiers_porteurs enable row level security;
alter table public.analyses_marche enable row level security;

create policy opportunites_select on public.opportunites for select using (public.is_fondateur() or organisation_id is null or public.peut_lire('opportunites', organisation_id));
create policy opportunites_insert on public.opportunites for insert with check (public.is_fondateur() or (organisation_id is not null and public.peut_creer('opportunites', organisation_id)));
create policy opportunites_update on public.opportunites for update using (public.is_fondateur() or (organisation_id is not null and public.peut_modifier('opportunites', organisation_id)));
create policy opportunites_delete on public.opportunites for delete using (public.is_fondateur() or (organisation_id is not null and public.peut_supprimer('opportunites', organisation_id)));

create policy concours_select on public.concours for select using (public.is_fondateur() or organisation_id is null or public.peut_lire('concours', organisation_id));
create policy concours_insert on public.concours for insert with check (public.is_fondateur() or (organisation_id is not null and public.peut_creer('concours', organisation_id)));
create policy concours_update on public.concours for update using (public.is_fondateur() or (organisation_id is not null and public.peut_modifier('concours', organisation_id)));
create policy concours_delete on public.concours for delete using (public.is_fondateur() or (organisation_id is not null and public.peut_supprimer('concours', organisation_id)));

create policy bourses_select on public.bourses for select using (public.is_fondateur() or organisation_id is null or public.peut_lire('bourses', organisation_id));
create policy bourses_insert on public.bourses for insert with check (public.is_fondateur() or (organisation_id is not null and public.peut_creer('bourses', organisation_id)));
create policy bourses_update on public.bourses for update using (public.is_fondateur() or (organisation_id is not null and public.peut_modifier('bourses', organisation_id)));
create policy bourses_delete on public.bourses for delete using (public.is_fondateur() or (organisation_id is not null and public.peut_supprimer('bourses', organisation_id)));

create policy financements_select on public.financements for select using (public.is_fondateur() or organisation_id is null or public.peut_lire('financements', organisation_id));
create policy financements_insert on public.financements for insert with check (public.is_fondateur() or (organisation_id is not null and public.peut_creer('financements', organisation_id)));
create policy financements_update on public.financements for update using (public.is_fondateur() or (organisation_id is not null and public.peut_modifier('financements', organisation_id)));
create policy financements_delete on public.financements for delete using (public.is_fondateur() or (organisation_id is not null and public.peut_supprimer('financements', organisation_id)));

create policy metiers_porteurs_select on public.metiers_porteurs for select using (public.is_fondateur() or organisation_id is null or public.peut_lire('metiers_porteurs', organisation_id));
create policy metiers_porteurs_insert on public.metiers_porteurs for insert with check (public.is_fondateur() or (organisation_id is not null and public.peut_creer('metiers_porteurs', organisation_id)));
create policy metiers_porteurs_update on public.metiers_porteurs for update using (public.is_fondateur() or (organisation_id is not null and public.peut_modifier('metiers_porteurs', organisation_id)));
create policy metiers_porteurs_delete on public.metiers_porteurs for delete using (public.is_fondateur() or (organisation_id is not null and public.peut_supprimer('metiers_porteurs', organisation_id)));

create policy analyses_marche_select on public.analyses_marche for select using (public.is_fondateur() or organisation_id is null or public.peut_lire('analyses_marche', organisation_id));
create policy analyses_marche_insert on public.analyses_marche for insert with check (public.is_fondateur() or (organisation_id is not null and public.peut_creer('analyses_marche', organisation_id)));
create policy analyses_marche_update on public.analyses_marche for update using (public.is_fondateur() or (organisation_id is not null and public.peut_modifier('analyses_marche', organisation_id)));
create policy analyses_marche_delete on public.analyses_marche for delete using (public.is_fondateur() or (organisation_id is not null and public.peut_supprimer('analyses_marche', organisation_id)));
