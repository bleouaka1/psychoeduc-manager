-- Étape 24 — Sauvegardes & export hors-ligne (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 26
-- Migration additive uniquement. Automatisation nocturne reelle (pg_cron/scheduler)
-- hors perimetre : tache d'infrastructure future, cf. DECISIONS_LOG.md.

create table if not exists public.sauvegardes_export (
  id uuid primary key default gen_random_uuid(),
  type_export text check (type_export in ('complet','partiel')),
  format text check (format in ('sql','csv','json')),
  taille_mo numeric,
  declenchee_par text check (declenchee_par in ('systeme','fondateur')),
  chiffree boolean not null default true check (chiffree = true),
  date_creation timestamptz not null default now(),
  url_stockage_temporaire text,
  expire_le timestamptz,
  statut text not null default 'en_cours' check (statut in ('en_cours','prete','expiree')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_sauvegardes_export_statut on public.sauvegardes_export(statut);

create trigger audit_sauvegardes_export after insert or update or delete on public.sauvegardes_export
  for each row execute function public.log_audit();

-- seed permissions : fondateur uniquement, conforme a la regle explicite du document
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values ('fondateur','sauvegardes_export', true, true, true, true)
on conflict (role, module) do nothing;

-- RLS : acces exclusivement fondateur
alter table public.sauvegardes_export enable row level security;

create policy sauvegardes_export_select on public.sauvegardes_export for select using (public.is_fondateur());
create policy sauvegardes_export_insert on public.sauvegardes_export for insert with check (public.is_fondateur());
create policy sauvegardes_export_update on public.sauvegardes_export for update using (public.is_fondateur());
create policy sauvegardes_export_delete on public.sauvegardes_export for delete using (public.is_fondateur());
