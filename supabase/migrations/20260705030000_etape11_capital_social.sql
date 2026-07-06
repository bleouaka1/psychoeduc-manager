-- Étape 11 — Capital social (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 13
-- Ne recree pas parents_tuteurs/mentors (Etape 5). Migration additive uniquement.

create table if not exists public.evaluations_capital_social (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  date_evaluation date not null default current_date,
  score_global numeric check (score_global between 0 and 100),
  niveau text,
  evalue_par uuid references public.profiles(id),
  commentaire text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- capital_social = vue sur la derniere evaluation par beneficiaire (jamais de table dupliquee)
create or replace view public.capital_social
with (security_invoker = true) as
select distinct on (beneficiaire_id)
  id, beneficiaire_id, organisation_id, date_evaluation, score_global, niveau, evalue_par, commentaire, created_at, updated_at
from public.evaluations_capital_social
order by beneficiaire_id, date_evaluation desc, created_at desc;

create table if not exists public.reseau_soutien (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  nom text,
  type_lien text check (type_lien in ('famille','ami','voisin','collegue','autre')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personnes_ressources (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  nom text,
  prenoms text,
  profession text,
  telephone text,
  email text,
  type_ressource text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.soutiens_beneficiaires (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  personne_ressource_id uuid references public.personnes_ressources(id) on delete set null,
  type_soutien text,
  description text,
  date_soutien date not null default current_date,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- index
create index if not exists idx_evaluations_capital_social_beneficiaire_id on public.evaluations_capital_social(beneficiaire_id);
create index if not exists idx_reseau_soutien_beneficiaire_id on public.reseau_soutien(beneficiaire_id);
create index if not exists idx_personnes_ressources_organisation_id on public.personnes_ressources(organisation_id);
create index if not exists idx_soutiens_beneficiaires_beneficiaire_id on public.soutiens_beneficiaires(beneficiaire_id);
create index if not exists idx_soutiens_beneficiaires_personne_ressource_id on public.soutiens_beneficiaires(personne_ressource_id);

-- triggers
create trigger set_updated_at before update on public.evaluations_capital_social for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reseau_soutien for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.personnes_ressources for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.soutiens_beneficiaires for each row execute function public.set_updated_at();

create trigger audit_evaluations_capital_social after insert or update or delete on public.evaluations_capital_social for each row execute function public.log_audit();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','evaluations_capital_social', true, true, true, true),
  ('fondateur','reseau_soutien', true, true, true, true),
  ('fondateur','personnes_ressources', true, true, true, true),
  ('fondateur','soutiens_beneficiaires', true, true, true, true),
  ('administrateur','evaluations_capital_social', true, true, true, false),
  ('administrateur','personnes_ressources', true, true, true, false),
  ('coordinateur','evaluations_capital_social', true, true, true, false),
  ('coordinateur','personnes_ressources', true, true, true, false),
  ('educateur','evaluations_capital_social', true, true, true, false),
  ('educateur','reseau_soutien', true, true, true, false),
  ('educateur','soutiens_beneficiaires', true, true, true, false),
  ('assistant_social','evaluations_capital_social', true, true, true, false),
  ('assistant_social','reseau_soutien', true, true, true, false),
  ('assistant_social','personnes_ressources', true, true, true, false),
  ('assistant_social','soutiens_beneficiaires', true, true, true, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.evaluations_capital_social enable row level security;
alter table public.reseau_soutien enable row level security;
alter table public.personnes_ressources enable row level security;
alter table public.soutiens_beneficiaires enable row level security;

create policy evaluations_capital_social_select on public.evaluations_capital_social for select using (public.is_fondateur() or public.peut_lire('evaluations_capital_social', organisation_id));
create policy evaluations_capital_social_insert on public.evaluations_capital_social for insert with check (public.is_fondateur() or public.peut_creer('evaluations_capital_social', organisation_id));
create policy evaluations_capital_social_update on public.evaluations_capital_social for update using (public.is_fondateur() or public.peut_modifier('evaluations_capital_social', organisation_id));
create policy evaluations_capital_social_delete on public.evaluations_capital_social for delete using (public.is_fondateur() or public.peut_supprimer('evaluations_capital_social', organisation_id));

create policy reseau_soutien_select on public.reseau_soutien for select using (public.is_fondateur() or public.peut_lire('reseau_soutien', organisation_id));
create policy reseau_soutien_insert on public.reseau_soutien for insert with check (public.is_fondateur() or public.peut_creer('reseau_soutien', organisation_id));
create policy reseau_soutien_update on public.reseau_soutien for update using (public.is_fondateur() or public.peut_modifier('reseau_soutien', organisation_id));
create policy reseau_soutien_delete on public.reseau_soutien for delete using (public.is_fondateur() or public.peut_supprimer('reseau_soutien', organisation_id));

create policy personnes_ressources_select on public.personnes_ressources for select using (public.is_fondateur() or public.peut_lire('personnes_ressources', organisation_id));
create policy personnes_ressources_insert on public.personnes_ressources for insert with check (public.is_fondateur() or public.peut_creer('personnes_ressources', organisation_id));
create policy personnes_ressources_update on public.personnes_ressources for update using (public.is_fondateur() or public.peut_modifier('personnes_ressources', organisation_id));
create policy personnes_ressources_delete on public.personnes_ressources for delete using (public.is_fondateur() or public.peut_supprimer('personnes_ressources', organisation_id));

create policy soutiens_beneficiaires_select on public.soutiens_beneficiaires for select using (public.is_fondateur() or public.peut_lire('soutiens_beneficiaires', organisation_id));
create policy soutiens_beneficiaires_insert on public.soutiens_beneficiaires for insert with check (public.is_fondateur() or public.peut_creer('soutiens_beneficiaires', organisation_id));
create policy soutiens_beneficiaires_update on public.soutiens_beneficiaires for update using (public.is_fondateur() or public.peut_modifier('soutiens_beneficiaires', organisation_id));
create policy soutiens_beneficiaires_delete on public.soutiens_beneficiaires for delete using (public.is_fondateur() or public.peut_supprimer('soutiens_beneficiaires', organisation_id));
