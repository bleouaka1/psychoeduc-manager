-- Étape 19 — Conformité et consentements (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 21
-- Migration additive uniquement.

create table if not exists public.consentements_donnees (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  type_consentement text check (type_consentement in ('formation','insertion','marketplace','temoignage','autre')),
  donnee_par_type text not null check (donnee_par_type in ('beneficiaire','parent_tuteur')),
  donnee_par_id uuid not null,
  date_consentement timestamptz not null default now(),
  revocable boolean not null default true,
  date_revocation timestamptz,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- T2 : ajout additif pur sur roles_utilisateurs (Etape 1)
alter table public.roles_utilisateurs
  add column if not exists donnees_minimales_export boolean not null default true;

-- index
create index if not exists idx_consentements_donnees_beneficiaire_id on public.consentements_donnees(beneficiaire_id);
create index if not exists idx_consentements_donnees_organisation_id on public.consentements_donnees(organisation_id);

create trigger audit_consentements_donnees after insert or update or delete on public.consentements_donnees
  for each row execute function public.log_audit();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','consentements_donnees', true, true, true, true),
  ('administrateur','consentements_donnees', true, true, true, false),
  ('coordinateur','consentements_donnees', true, true, true, false),
  ('assistant_social','consentements_donnees', true, true, true, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.consentements_donnees enable row level security;

create policy consentements_donnees_select on public.consentements_donnees
  for select using (
    public.is_fondateur()
    or public.peut_lire('consentements_donnees', organisation_id)
    or (donnee_par_type = 'beneficiaire' and donnee_par_id = auth.uid())
  );

create policy consentements_donnees_insert on public.consentements_donnees
  for insert with check (public.is_fondateur() or public.peut_creer('consentements_donnees', organisation_id));

-- revocation : personnel habilite OU la personne beneficiaire elle-meme (self-service, cf. DECISIONS_LOG.md)
create policy consentements_donnees_update on public.consentements_donnees
  for update using (
    public.is_fondateur()
    or public.peut_modifier('consentements_donnees', organisation_id)
    or (donnee_par_type = 'beneficiaire' and donnee_par_id = auth.uid())
  );
