-- Étape 21 — Centre IA (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 23
-- Migration additive uniquement.

-- T1 : ajout additif sur quotas_organisations (Etape 2)
alter table public.quotas_organisations
  add column if not exists quota_ia_tokens_mensuel int default 100000,
  add column if not exists ia_tokens_consommes_mois_courant int not null default 0;

create table if not exists public.agents_ia (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  nom text not null,
  type_agent text,
  description text,
  actif boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions_ia (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents_ia(id) on delete set null,
  profile_id uuid references public.profiles(id),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  titre text,
  contexte jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rapports_ia (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions_ia(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  contenu text,
  type_rapport text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recommandations_ia (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions_ia(id) on delete set null,
  beneficiaire_id uuid references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  contenu text not null,
  type_recommandation text,
  statut text not null default 'proposee' check (statut in ('proposee','acceptee','rejetee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- append-only : registre de consommation IA, jamais modifie apres coup
create table if not exists public.consommations_ia (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  agent_id uuid references public.agents_ia(id) on delete set null,
  session_id uuid references public.sessions_ia(id) on delete set null,
  nb_tokens int not null,
  cout_estime numeric,
  created_at timestamptz not null default now()
);

-- Garde-fou de securite explicite du document : verifie le quota AVANT d'accepter
-- la consommation, rejette si depassement -- impossible a contourner cote base.
create or replace function public.enforce_quota_ia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota int;
  v_consomme int;
begin
  select quota_ia_tokens_mensuel, ia_tokens_consommes_mois_courant
    into v_quota, v_consomme
  from public.quotas_organisations
  where organisation_id = new.organisation_id
  for update;

  if v_quota is not null and (coalesce(v_consomme, 0) + new.nb_tokens) > v_quota then
    raise exception 'Quota IA mensuel depasse pour cette organisation (quota=%, deja consomme=%, demande=%)', v_quota, v_consomme, new.nb_tokens;
  end if;

  update public.quotas_organisations
  set ia_tokens_consommes_mois_courant = coalesce(ia_tokens_consommes_mois_courant, 0) + new.nb_tokens
  where organisation_id = new.organisation_id;

  return new;
end;
$$;

create trigger before_consommation_ia before insert on public.consommations_ia
  for each row execute function public.enforce_quota_ia();

-- index
create index if not exists idx_agents_ia_organisation_id on public.agents_ia(organisation_id);
create index if not exists idx_sessions_ia_organisation_id on public.sessions_ia(organisation_id);
create index if not exists idx_sessions_ia_profile_id on public.sessions_ia(profile_id);
create index if not exists idx_rapports_ia_session_id on public.rapports_ia(session_id);
create index if not exists idx_recommandations_ia_beneficiaire_id on public.recommandations_ia(beneficiaire_id);
create index if not exists idx_consommations_ia_organisation_id on public.consommations_ia(organisation_id);

create trigger set_updated_at before update on public.agents_ia for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.sessions_ia for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rapports_ia for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.recommandations_ia for each row execute function public.set_updated_at();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','agents_ia', true, true, true, true),
  ('fondateur','sessions_ia', true, true, true, true),
  ('fondateur','rapports_ia', true, true, true, true),
  ('fondateur','recommandations_ia', true, true, true, true),
  ('fondateur','consommations_ia', true, true, false, false),
  ('administrateur','sessions_ia', true, true, true, false),
  ('administrateur','consommations_ia', true, true, false, false),
  ('coordinateur','recommandations_ia', true, false, true, false),
  ('educateur','sessions_ia', true, true, true, false),
  ('educateur','recommandations_ia', true, false, true, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.agents_ia enable row level security;
alter table public.sessions_ia enable row level security;
alter table public.rapports_ia enable row level security;
alter table public.recommandations_ia enable row level security;
alter table public.consommations_ia enable row level security;

create policy agents_ia_select on public.agents_ia for select using (public.is_fondateur() or organisation_id is null or public.peut_lire('agents_ia', organisation_id));
create policy agents_ia_write on public.agents_ia for all using (public.is_fondateur()) with check (public.is_fondateur());

create policy sessions_ia_select on public.sessions_ia for select using (public.is_fondateur() or profile_id = auth.uid() or public.peut_lire('sessions_ia', organisation_id));
create policy sessions_ia_insert on public.sessions_ia for insert with check (public.is_fondateur() or profile_id = auth.uid() or public.peut_creer('sessions_ia', organisation_id));
create policy sessions_ia_update on public.sessions_ia for update using (public.is_fondateur() or profile_id = auth.uid() or public.peut_modifier('sessions_ia', organisation_id));

create policy rapports_ia_select on public.rapports_ia for select using (public.is_fondateur() or public.peut_lire('rapports_ia', organisation_id));
create policy rapports_ia_insert on public.rapports_ia for insert with check (public.is_fondateur() or public.peut_creer('rapports_ia', organisation_id));

create policy recommandations_ia_select on public.recommandations_ia for select using (public.is_fondateur() or public.peut_lire('recommandations_ia', organisation_id));
create policy recommandations_ia_insert on public.recommandations_ia for insert with check (public.is_fondateur() or public.peut_creer('recommandations_ia', organisation_id));
create policy recommandations_ia_update on public.recommandations_ia for update using (public.is_fondateur() or public.peut_modifier('recommandations_ia', organisation_id));

create policy consommations_ia_select on public.consommations_ia for select using (public.is_fondateur() or public.peut_lire('consommations_ia', organisation_id));
create policy consommations_ia_insert on public.consommations_ia for insert with check (public.is_fondateur() or public.peut_creer('consommations_ia', organisation_id));
