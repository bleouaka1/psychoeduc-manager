-- Dashboard bénéficiaire v3, Lot F — préférences personnelles (thème, accessibilité,
-- mode d'interaction). Paramètre par PROFIL (auth.uid()), jamais un thème de plateforme
-- global — n'affecte que /mon-espace via data-theme sur .mon-espace-theme.
create table if not exists public.preferences_utilisateur (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade unique,
  theme_id text not null default 'sombre_dore',
  mode_accessibilite boolean not null default false,
  mode_interaction text not null default 'mixte' check (mode_interaction in ('texte', 'vocal', 'mixte')),
  updated_at timestamptz not null default now()
);

alter table public.preferences_utilisateur enable row level security;

create policy preferences_utilisateur_select on public.preferences_utilisateur for select using (profile_id = auth.uid());
create policy preferences_utilisateur_insert on public.preferences_utilisateur for insert with check (profile_id = auth.uid());
create policy preferences_utilisateur_update on public.preferences_utilisateur for update using (profile_id = auth.uid());
