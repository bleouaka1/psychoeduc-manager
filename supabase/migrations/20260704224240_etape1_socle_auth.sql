-- Étape 1 — Authentification, organisations et rôles (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 3
-- Migration additive uniquement (base repartie de zéro après backup_avant_reset.sql).

-- ============================================================================
-- T1 — Extensions
-- ============================================================================
create extension if not exists pgcrypto;

-- ============================================================================
-- T2 — profiles (1:1 avec auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text,
  prenoms text,
  email text,
  telephone text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T3 — trigger de création automatique de profil
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, created_at, updated_at)
  values (new.id, new.email, now(), now())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- T4 — organisations
-- ============================================================================
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  type_organisation text not null check (type_organisation in (
    'solo','structure','centre','ong','ecole','employeur','entreprise','association','fondation'
  )),
  pays text,
  ville text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T5 — membres_organisations
-- ============================================================================
create table if not exists public.membres_organisations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  statut text not null default 'actif' check (statut in ('actif','invite','suspendu','retire')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, profile_id)
);

-- ============================================================================
-- T6 — roles_utilisateurs (un membre peut cumuler plusieurs rôles actifs)
-- ============================================================================
create table if not exists public.roles_utilisateurs (
  id uuid primary key default gen_random_uuid(),
  membre_organisation_id uuid not null references public.membres_organisations(id) on delete cascade,
  role text not null check (role in (
    'fondateur','super_admin_client','administrateur','directeur','coordinateur','educateur',
    'formateur','enseignant','coach','consultant','psychologue','assistant_social',
    'beneficiaire','parent','tuteur','mentor','employeur','recruteur','partenaire'
  )),
  actif boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membre_organisation_id, role)
);

-- ============================================================================
-- T7 — permissions (matrice rôle x module)
-- ============================================================================
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in (
    'fondateur','super_admin_client','administrateur','directeur','coordinateur','educateur',
    'formateur','enseignant','coach','consultant','psychologue','assistant_social',
    'beneficiaire','parent','tuteur','mentor','employeur','recruteur','partenaire'
  )),
  module text not null,
  peut_lire boolean not null default false,
  peut_creer boolean not null default false,
  peut_modifier boolean not null default false,
  peut_supprimer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role, module)
);

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','organisations', true, true, true, true),
  ('fondateur','membres_organisations', true, true, true, true),
  ('fondateur','roles_utilisateurs', true, true, true, true),
  ('fondateur','permissions', true, true, true, true),
  ('fondateur','audit_logs', true, false, false, false),
  ('administrateur','organisations', true, false, true, false),
  ('administrateur','membres_organisations', true, true, true, true),
  ('administrateur','roles_utilisateurs', true, true, true, true),
  ('administrateur','audit_logs', true, false, false, false),
  ('beneficiaire','organisations', true, false, false, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- T8 — audit_logs (append-only strict : jamais d'UPDATE/DELETE, pas d'updated_at)
-- ============================================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_cible text not null,
  ligne_id uuid,
  donnees_avant jsonb,
  donnees_apres jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- T9 — fonctions RLS de base (SECURITY DEFINER : évite la récursion de policies,
-- s'exécutent avec les privilèges du propriétaire de table, qui contourne RLS)
-- ============================================================================
create or replace function public.is_fondateur()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.roles_utilisateurs ru
    join public.membres_organisations mo on mo.id = ru.membre_organisation_id
    where mo.profile_id = auth.uid()
      and ru.role = 'fondateur'
      and ru.actif = true
      and mo.statut = 'actif'
  );
$$;

create or replace function public.est_membre_organisation(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.membres_organisations mo
    where mo.organisation_id = p_organisation_id
      and mo.profile_id = auth.uid()
      and mo.statut = 'actif'
  ) or public.is_fondateur();
$$;

create or replace function public.role_dans_organisation(p_organisation_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select ru.role
  from public.roles_utilisateurs ru
  join public.membres_organisations mo on mo.id = ru.membre_organisation_id
  where mo.organisation_id = p_organisation_id
    and mo.profile_id = auth.uid()
    and mo.statut = 'actif'
    and ru.actif = true;
$$;

-- ============================================================================
-- T10 — fonctions de permission par module
-- ============================================================================
create or replace function public.peut_lire(p_module text, p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_fondateur() or exists (
    select 1
    from public.role_dans_organisation(p_organisation_id) r(role)
    join public.permissions p on p.role = r.role and p.module = p_module
    where p.peut_lire = true
  );
$$;

create or replace function public.peut_creer(p_module text, p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_fondateur() or exists (
    select 1
    from public.role_dans_organisation(p_organisation_id) r(role)
    join public.permissions p on p.role = r.role and p.module = p_module
    where p.peut_creer = true
  );
$$;

create or replace function public.peut_modifier(p_module text, p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_fondateur() or exists (
    select 1
    from public.role_dans_organisation(p_organisation_id) r(role)
    join public.permissions p on p.role = r.role and p.module = p_module
    where p.peut_modifier = true
  );
$$;

create or replace function public.peut_supprimer(p_module text, p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_fondateur() or exists (
    select 1
    from public.role_dans_organisation(p_organisation_id) r(role)
    join public.permissions p on p.role = r.role and p.module = p_module
    where p.peut_supprimer = true
  );
$$;

-- ============================================================================
-- T12 — trigger générique updated_at
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.membres_organisations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.roles_utilisateurs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.permissions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- T13 — trigger d'audit générique (jamais sur audit_logs elle-même, jamais sur profiles)
-- ============================================================================
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organisation_id uuid;
  v_profile_id uuid := auth.uid();
begin
  if TG_TABLE_NAME = 'organisations' then
    v_organisation_id := coalesce(new.id, old.id);
  elsif TG_TABLE_NAME = 'membres_organisations' then
    v_organisation_id := coalesce(new.organisation_id, old.organisation_id);
  elsif TG_TABLE_NAME = 'roles_utilisateurs' then
    select mo.organisation_id into v_organisation_id
    from public.membres_organisations mo
    where mo.id = coalesce(new.membre_organisation_id, old.membre_organisation_id);
  else
    v_organisation_id := null;
  end if;

  insert into public.audit_logs (organisation_id, profile_id, action, table_cible, ligne_id, donnees_avant, donnees_apres)
  values (
    v_organisation_id,
    v_profile_id,
    TG_OP,
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_organisations after insert or update or delete on public.organisations
  for each row execute function public.log_audit();
create trigger audit_membres_organisations after insert or update or delete on public.membres_organisations
  for each row execute function public.log_audit();
create trigger audit_roles_utilisateurs after insert or update or delete on public.roles_utilisateurs
  for each row execute function public.log_audit();
create trigger audit_permissions after insert or update or delete on public.permissions
  for each row execute function public.log_audit();

-- ============================================================================
-- T12 — index sur toutes les FK
-- ============================================================================
create index if not exists idx_organisations_created_by on public.organisations(created_by);
create index if not exists idx_membres_organisations_organisation_id on public.membres_organisations(organisation_id);
create index if not exists idx_membres_organisations_profile_id on public.membres_organisations(profile_id);
create index if not exists idx_membres_organisations_created_by on public.membres_organisations(created_by);
create index if not exists idx_roles_utilisateurs_membre_organisation_id on public.roles_utilisateurs(membre_organisation_id);
create index if not exists idx_audit_logs_organisation_id on public.audit_logs(organisation_id);
create index if not exists idx_audit_logs_profile_id on public.audit_logs(profile_id);
create index if not exists idx_audit_logs_table_cible on public.audit_logs(table_cible);

-- ============================================================================
-- Bootstrap : auto-adhésion + rôle administrateur du créateur d'une organisation.
-- Repose sur le fait que ces tables appartiennent au rôle propriétaire (postgres),
-- qui contourne RLS par défaut (pas de FORCE ROW LEVEL SECURITY) : ce trigger
-- peut donc écrire dans membres_organisations/roles_utilisateurs même pour le tout
-- premier utilisateur, sans qu'aucun "fondateur" n'existe encore.
-- Le rôle plateforme "fondateur" (accès global) reste une attribution manuelle
-- ponctuelle, faite une fois via SQL direct sur le compte d'Angenor.
-- ============================================================================
create or replace function public.handle_new_organisation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membre_id uuid;
begin
  if new.created_by is not null then
    insert into public.membres_organisations (organisation_id, profile_id, statut, created_by)
    values (new.id, new.created_by, 'actif', new.created_by)
    returning id into v_membre_id;

    insert into public.roles_utilisateurs (membre_organisation_id, role, created_by)
    values (v_membre_id, 'administrateur', new.created_by);
  end if;
  return new;
end;
$$;

create trigger on_organisation_created after insert on public.organisations
  for each row execute function public.handle_new_organisation();

-- ============================================================================
-- T11 — RLS
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.membres_organisations enable row level security;
alter table public.roles_utilisateurs enable row level security;
alter table public.permissions enable row level security;
alter table public.audit_logs enable row level security;

-- profiles : chacun voit/modifie son propre profil ; un collègue de la même
-- organisation peut voir le profil (nécessaire pour lister les membres) ; fondateur voit tout.
create policy profiles_select on public.profiles
  for select using (
    auth.uid() = id
    or public.is_fondateur()
    or exists (
      select 1 from public.membres_organisations mo1
      join public.membres_organisations mo2 on mo1.organisation_id = mo2.organisation_id
      where mo1.profile_id = auth.uid() and mo2.profile_id = profiles.id
    )
  );

create policy profiles_update on public.profiles
  for update using (auth.uid() = id or public.is_fondateur());

-- organisations
create policy organisations_select on public.organisations
  for select using (public.is_fondateur() or public.est_membre_organisation(id));

create policy organisations_insert on public.organisations
  for insert with check (auth.uid() = created_by);

create policy organisations_update on public.organisations
  for update using (public.is_fondateur() or public.peut_modifier('organisations', id));

create policy organisations_delete on public.organisations
  for delete using (public.is_fondateur());

-- membres_organisations
create policy membres_organisations_select on public.membres_organisations
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));

create policy membres_organisations_insert on public.membres_organisations
  for insert with check (public.is_fondateur() or public.peut_creer('membres_organisations', organisation_id));

create policy membres_organisations_update on public.membres_organisations
  for update using (public.is_fondateur() or public.peut_modifier('membres_organisations', organisation_id));

create policy membres_organisations_delete on public.membres_organisations
  for delete using (public.is_fondateur() or public.peut_supprimer('membres_organisations', organisation_id));

-- roles_utilisateurs
create policy roles_utilisateurs_select on public.roles_utilisateurs
  for select using (
    public.is_fondateur()
    or exists (
      select 1 from public.membres_organisations mo
      where mo.id = roles_utilisateurs.membre_organisation_id
        and public.est_membre_organisation(mo.organisation_id)
    )
  );

create policy roles_utilisateurs_insert on public.roles_utilisateurs
  for insert with check (
    public.is_fondateur()
    or exists (
      select 1 from public.membres_organisations mo
      where mo.id = membre_organisation_id
        and public.peut_creer('roles_utilisateurs', mo.organisation_id)
    )
  );

create policy roles_utilisateurs_update on public.roles_utilisateurs
  for update using (
    public.is_fondateur()
    or exists (
      select 1 from public.membres_organisations mo
      where mo.id = roles_utilisateurs.membre_organisation_id
        and public.peut_modifier('roles_utilisateurs', mo.organisation_id)
    )
  );

create policy roles_utilisateurs_delete on public.roles_utilisateurs
  for delete using (
    public.is_fondateur()
    or exists (
      select 1 from public.membres_organisations mo
      where mo.id = roles_utilisateurs.membre_organisation_id
        and public.peut_supprimer('roles_utilisateurs', mo.organisation_id)
    )
  );

-- permissions : lecture ouverte à tout authentifié (nécessaire côté client pour bâtir l'UI),
-- écriture réservée au fondateur (seul à pouvoir ajuster la matrice des droits).
create policy permissions_select on public.permissions
  for select using (auth.role() = 'authenticated' or public.is_fondateur());

create policy permissions_write on public.permissions
  for all using (public.is_fondateur()) with check (public.is_fondateur());

-- audit_logs : lecture scoping organisation/fondateur ; aucune policy d'écriture pour le rôle
-- authenticated → INSERT/UPDATE/DELETE refusés par défaut. Seul le trigger log_audit()
-- (exécuté avec les privilèges du propriétaire de table) peut y écrire. Jamais d'UPDATE/DELETE,
-- même pour le fondateur : l'append-only est total.
create policy audit_logs_select on public.audit_logs
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
