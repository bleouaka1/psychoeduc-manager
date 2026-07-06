-- Étape 22 — Support (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 24
-- Migration additive uniquement.

create table if not exists public.tickets_support (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sujet text not null,
  description text,
  categorie text,
  priorite text not null default 'normale' check (priorite in ('basse','normale','haute','urgente')),
  statut text not null default 'ouvert' check (statut in ('ouvert','en_cours','resolu','ferme')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reponses_support (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets_support(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  contenu text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  reponse text,
  categorie text,
  ordre int,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutoriels (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  contenu text,
  type_contenu text check (type_contenu in ('video','document','lien')),
  url_ressource text,
  categorie text,
  ordre int,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- index
create index if not exists idx_tickets_support_organisation_id on public.tickets_support(organisation_id);
create index if not exists idx_tickets_support_profile_id on public.tickets_support(profile_id);
create index if not exists idx_reponses_support_ticket_id on public.reponses_support(ticket_id);

create trigger set_updated_at before update on public.tickets_support for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.faq for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tutoriels for each row execute function public.set_updated_at();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','tickets_support', true, true, true, true),
  ('fondateur','reponses_support', true, true, true, true),
  ('fondateur','faq', true, true, true, true),
  ('fondateur','tutoriels', true, true, true, true),
  ('administrateur','tickets_support', true, true, true, false),
  ('administrateur','reponses_support', true, true, false, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.tickets_support enable row level security;
alter table public.reponses_support enable row level security;
alter table public.faq enable row level security;
alter table public.tutoriels enable row level security;

create policy tickets_support_select on public.tickets_support
  for select using (public.is_fondateur() or profile_id = auth.uid() or (organisation_id is not null and public.peut_lire('tickets_support', organisation_id)));
create policy tickets_support_insert on public.tickets_support
  for insert with check (public.is_fondateur() or profile_id = auth.uid());
create policy tickets_support_update on public.tickets_support
  for update using (public.is_fondateur() or profile_id = auth.uid() or (organisation_id is not null and public.peut_modifier('tickets_support', organisation_id)));

create policy reponses_support_select on public.reponses_support
  for select using (
    public.is_fondateur()
    or exists (select 1 from public.tickets_support t where t.id = reponses_support.ticket_id and (t.profile_id = auth.uid() or (t.organisation_id is not null and public.peut_lire('reponses_support', t.organisation_id))))
  );
create policy reponses_support_insert on public.reponses_support
  for insert with check (
    public.is_fondateur()
    or exists (select 1 from public.tickets_support t where t.id = ticket_id and (t.profile_id = auth.uid() or (t.organisation_id is not null and public.peut_creer('reponses_support', t.organisation_id))))
  );

create policy faq_select on public.faq for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy faq_write on public.faq for all using (public.is_fondateur()) with check (public.is_fondateur());

create policy tutoriels_select on public.tutoriels for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy tutoriels_write on public.tutoriels for all using (public.is_fondateur()) with check (public.is_fondateur());
