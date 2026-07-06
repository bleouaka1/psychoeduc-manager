-- Étape 25 — Paramètres généraux (architecture v5, dernière étape du schéma)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 27
-- parametres_plateforme (taux de commission inclus) deja construite a l'Etape 16.
-- Migration additive uniquement.

create table if not exists public.parametres_modules (
  id uuid primary key default gen_random_uuid(),
  module text not null unique,
  actif_par_defaut boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parametres_securite (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,
  valeur jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public.parametres_notifications (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,
  valeur jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.parametres_modules for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.parametres_securite for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.parametres_notifications for each row execute function public.set_updated_at();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','parametres_modules', true, true, true, true),
  ('fondateur','parametres_securite', true, true, true, true),
  ('fondateur','parametres_notifications', true, true, true, true)
on conflict (role, module) do nothing;

-- RLS : lecture ouverte a tout authentifie, ecriture reservee au fondateur (meme pattern que parametres_plateforme)
alter table public.parametres_modules enable row level security;
alter table public.parametres_securite enable row level security;
alter table public.parametres_notifications enable row level security;

create policy parametres_modules_select on public.parametres_modules for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy parametres_modules_write on public.parametres_modules for all using (public.is_fondateur()) with check (public.is_fondateur());

create policy parametres_securite_select on public.parametres_securite for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy parametres_securite_write on public.parametres_securite for all using (public.is_fondateur()) with check (public.is_fondateur());

create policy parametres_notifications_select on public.parametres_notifications for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy parametres_notifications_write on public.parametres_notifications for all using (public.is_fondateur()) with check (public.is_fondateur());
