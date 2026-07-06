-- Étape 12 — Insertion professionnelle (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 14
-- Migration additive uniquement.

create table if not exists public.entreprises_partenaires (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  nom text not null,
  secteur text,
  contact_nom text,
  contact_telephone text,
  contact_email text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offres_emploi (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  entreprise_partenaire_id uuid references public.entreprises_partenaires(id) on delete set null,
  titre text not null,
  description text,
  type_contrat text check (type_contrat in ('cdi','cdd','interim','freelance')),
  lieu text,
  salaire_propose text,
  date_publication date not null default current_date,
  date_expiration date,
  statut text not null default 'ouverte' check (statut in ('ouverte','fermee','pourvue')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offres_stage (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  entreprise_partenaire_id uuid references public.entreprises_partenaires(id) on delete set null,
  titre text not null,
  description text,
  duree_semaines int,
  lieu text,
  remuneree boolean not null default false,
  date_publication date not null default current_date,
  date_expiration date,
  statut text not null default 'ouverte' check (statut in ('ouverte','fermee','pourvue')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.demandes_stage (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  offre_stage_id uuid not null references public.offres_stage(id) on delete cascade,
  date_demande date not null default current_date,
  statut text not null default 'en_attente' check (statut in ('en_attente','acceptee','refusee')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidatures (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  offre_emploi_id uuid not null references public.offres_emploi(id) on delete cascade,
  date_candidature date not null default current_date,
  statut text not null default 'soumise' check (statut in ('soumise','en_cours','acceptee','refusee')),
  cv_url text,
  lettre_motivation text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recrutements (
  id uuid primary key default gen_random_uuid(),
  candidature_id uuid not null references public.candidatures(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  entreprise_partenaire_id uuid references public.entreprises_partenaires(id) on delete set null,
  date_recrutement date not null default current_date,
  poste text,
  salaire numeric,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insertions_professionnelles (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  recrutement_id uuid references public.recrutements(id) on delete set null,
  type_insertion text check (type_insertion in ('emploi','stage','auto_emploi')),
  date_debut date not null default current_date,
  date_fin date,
  statut text not null default 'en_cours' check (statut in ('en_cours','terminee','rompue')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stages (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  offre_stage_id uuid references public.offres_stage(id) on delete set null,
  date_debut date not null default current_date,
  date_fin date,
  statut text not null default 'en_cours' check (statut in ('en_cours','termine','rompu')),
  evaluation_finale text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- porte assez d'info pour que l'Etape 18 (Reussites) calcule "maintien >= 3 mois"
-- par difference de dates au moment voulu, jamais une duree stockee en dur.
create table if not exists public.suivis_post_insertion (
  id uuid primary key default gen_random_uuid(),
  insertion_id uuid not null references public.insertions_professionnelles(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  date_suivi date not null default current_date,
  statut_maintien text check (statut_maintien in ('maintenu','rompu')),
  commentaire text,
  suivi_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evaluations_insertion (
  id uuid primary key default gen_random_uuid(),
  insertion_id uuid not null references public.insertions_professionnelles(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  date_evaluation date not null default current_date,
  satisfaction_beneficiaire text,
  satisfaction_employeur text,
  commentaire text,
  evalue_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- index
create index if not exists idx_entreprises_partenaires_organisation_id on public.entreprises_partenaires(organisation_id);
create index if not exists idx_offres_emploi_organisation_id on public.offres_emploi(organisation_id);
create index if not exists idx_offres_stage_organisation_id on public.offres_stage(organisation_id);
create index if not exists idx_demandes_stage_beneficiaire_id on public.demandes_stage(beneficiaire_id);
create index if not exists idx_demandes_stage_offre_stage_id on public.demandes_stage(offre_stage_id);
create index if not exists idx_candidatures_beneficiaire_id on public.candidatures(beneficiaire_id);
create index if not exists idx_candidatures_offre_emploi_id on public.candidatures(offre_emploi_id);
create index if not exists idx_recrutements_candidature_id on public.recrutements(candidature_id);
create index if not exists idx_insertions_professionnelles_beneficiaire_id on public.insertions_professionnelles(beneficiaire_id);
create index if not exists idx_stages_beneficiaire_id on public.stages(beneficiaire_id);
create index if not exists idx_suivis_post_insertion_insertion_id on public.suivis_post_insertion(insertion_id);
create index if not exists idx_evaluations_insertion_insertion_id on public.evaluations_insertion(insertion_id);

-- triggers
create trigger set_updated_at before update on public.entreprises_partenaires for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.offres_emploi for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.offres_stage for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.demandes_stage for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.candidatures for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.recrutements for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.insertions_professionnelles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.stages for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.suivis_post_insertion for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.evaluations_insertion for each row execute function public.set_updated_at();

create trigger audit_candidatures after insert or update or delete on public.candidatures for each row execute function public.log_audit();
create trigger audit_recrutements after insert or update or delete on public.recrutements for each row execute function public.log_audit();
create trigger audit_insertions_professionnelles after insert or update or delete on public.insertions_professionnelles for each row execute function public.log_audit();
create trigger audit_suivis_post_insertion after insert or update or delete on public.suivis_post_insertion for each row execute function public.log_audit();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','entreprises_partenaires', true, true, true, true),
  ('fondateur','offres_emploi', true, true, true, true),
  ('fondateur','offres_stage', true, true, true, true),
  ('fondateur','demandes_stage', true, true, true, true),
  ('fondateur','candidatures', true, true, true, true),
  ('fondateur','recrutements', true, true, true, true),
  ('fondateur','insertions_professionnelles', true, true, true, true),
  ('fondateur','stages', true, true, true, true),
  ('fondateur','suivis_post_insertion', true, true, true, true),
  ('fondateur','evaluations_insertion', true, true, true, true),
  ('administrateur','offres_emploi', true, true, true, false),
  ('administrateur','offres_stage', true, true, true, false),
  ('administrateur','entreprises_partenaires', true, true, true, false),
  ('coordinateur','offres_emploi', true, true, true, false),
  ('coordinateur','offres_stage', true, true, true, false),
  ('coordinateur','insertions_professionnelles', true, true, true, false),
  ('educateur','candidatures', true, true, true, false),
  ('educateur','demandes_stage', true, true, true, false),
  ('educateur','insertions_professionnelles', true, true, true, false),
  ('educateur','suivis_post_insertion', true, true, true, false),
  ('assistant_social','candidatures', true, true, true, false),
  ('assistant_social','insertions_professionnelles', true, true, true, false),
  ('assistant_social','suivis_post_insertion', true, true, true, false),
  ('employeur','offres_emploi', true, true, true, false),
  ('employeur','candidatures', true, false, true, false),
  ('employeur','recrutements', true, true, false, false),
  ('recruteur','offres_emploi', true, true, true, false),
  ('recruteur','candidatures', true, false, true, false),
  ('recruteur','recrutements', true, true, false, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.entreprises_partenaires enable row level security;
alter table public.offres_emploi enable row level security;
alter table public.offres_stage enable row level security;
alter table public.demandes_stage enable row level security;
alter table public.candidatures enable row level security;
alter table public.recrutements enable row level security;
alter table public.insertions_professionnelles enable row level security;
alter table public.stages enable row level security;
alter table public.suivis_post_insertion enable row level security;
alter table public.evaluations_insertion enable row level security;

create policy entreprises_partenaires_select on public.entreprises_partenaires for select using (public.is_fondateur() or public.peut_lire('entreprises_partenaires', organisation_id));
create policy entreprises_partenaires_insert on public.entreprises_partenaires for insert with check (public.is_fondateur() or public.peut_creer('entreprises_partenaires', organisation_id));
create policy entreprises_partenaires_update on public.entreprises_partenaires for update using (public.is_fondateur() or public.peut_modifier('entreprises_partenaires', organisation_id));
create policy entreprises_partenaires_delete on public.entreprises_partenaires for delete using (public.is_fondateur() or public.peut_supprimer('entreprises_partenaires', organisation_id));

create policy offres_emploi_select on public.offres_emploi for select using (public.is_fondateur() or public.peut_lire('offres_emploi', organisation_id));
create policy offres_emploi_insert on public.offres_emploi for insert with check (public.is_fondateur() or public.peut_creer('offres_emploi', organisation_id));
create policy offres_emploi_update on public.offres_emploi for update using (public.is_fondateur() or public.peut_modifier('offres_emploi', organisation_id));
create policy offres_emploi_delete on public.offres_emploi for delete using (public.is_fondateur() or public.peut_supprimer('offres_emploi', organisation_id));

create policy offres_stage_select on public.offres_stage for select using (public.is_fondateur() or public.peut_lire('offres_stage', organisation_id));
create policy offres_stage_insert on public.offres_stage for insert with check (public.is_fondateur() or public.peut_creer('offres_stage', organisation_id));
create policy offres_stage_update on public.offres_stage for update using (public.is_fondateur() or public.peut_modifier('offres_stage', organisation_id));
create policy offres_stage_delete on public.offres_stage for delete using (public.is_fondateur() or public.peut_supprimer('offres_stage', organisation_id));

create policy demandes_stage_select on public.demandes_stage for select using (public.is_fondateur() or public.peut_lire('demandes_stage', organisation_id));
create policy demandes_stage_insert on public.demandes_stage for insert with check (public.is_fondateur() or public.peut_creer('demandes_stage', organisation_id));
create policy demandes_stage_update on public.demandes_stage for update using (public.is_fondateur() or public.peut_modifier('demandes_stage', organisation_id));
create policy demandes_stage_delete on public.demandes_stage for delete using (public.is_fondateur() or public.peut_supprimer('demandes_stage', organisation_id));

create policy candidatures_select on public.candidatures for select using (public.is_fondateur() or public.peut_lire('candidatures', organisation_id));
create policy candidatures_insert on public.candidatures for insert with check (public.is_fondateur() or public.peut_creer('candidatures', organisation_id));
create policy candidatures_update on public.candidatures for update using (public.is_fondateur() or public.peut_modifier('candidatures', organisation_id));
create policy candidatures_delete on public.candidatures for delete using (public.is_fondateur() or public.peut_supprimer('candidatures', organisation_id));

create policy recrutements_select on public.recrutements for select using (public.is_fondateur() or public.peut_lire('recrutements', organisation_id));
create policy recrutements_insert on public.recrutements for insert with check (public.is_fondateur() or public.peut_creer('recrutements', organisation_id));
create policy recrutements_update on public.recrutements for update using (public.is_fondateur() or public.peut_modifier('recrutements', organisation_id));
create policy recrutements_delete on public.recrutements for delete using (public.is_fondateur() or public.peut_supprimer('recrutements', organisation_id));

create policy insertions_professionnelles_select on public.insertions_professionnelles for select using (public.is_fondateur() or public.peut_lire('insertions_professionnelles', organisation_id));
create policy insertions_professionnelles_insert on public.insertions_professionnelles for insert with check (public.is_fondateur() or public.peut_creer('insertions_professionnelles', organisation_id));
create policy insertions_professionnelles_update on public.insertions_professionnelles for update using (public.is_fondateur() or public.peut_modifier('insertions_professionnelles', organisation_id));
create policy insertions_professionnelles_delete on public.insertions_professionnelles for delete using (public.is_fondateur() or public.peut_supprimer('insertions_professionnelles', organisation_id));

create policy stages_select on public.stages for select using (public.is_fondateur() or public.peut_lire('stages', organisation_id));
create policy stages_insert on public.stages for insert with check (public.is_fondateur() or public.peut_creer('stages', organisation_id));
create policy stages_update on public.stages for update using (public.is_fondateur() or public.peut_modifier('stages', organisation_id));
create policy stages_delete on public.stages for delete using (public.is_fondateur() or public.peut_supprimer('stages', organisation_id));

create policy suivis_post_insertion_select on public.suivis_post_insertion for select using (public.is_fondateur() or public.peut_lire('suivis_post_insertion', organisation_id));
create policy suivis_post_insertion_insert on public.suivis_post_insertion for insert with check (public.is_fondateur() or public.peut_creer('suivis_post_insertion', organisation_id));
create policy suivis_post_insertion_update on public.suivis_post_insertion for update using (public.is_fondateur() or public.peut_modifier('suivis_post_insertion', organisation_id));
create policy suivis_post_insertion_delete on public.suivis_post_insertion for delete using (public.is_fondateur() or public.peut_supprimer('suivis_post_insertion', organisation_id));

create policy evaluations_insertion_select on public.evaluations_insertion for select using (public.is_fondateur() or public.peut_lire('evaluations_insertion', organisation_id));
create policy evaluations_insertion_insert on public.evaluations_insertion for insert with check (public.is_fondateur() or public.peut_creer('evaluations_insertion', organisation_id));
create policy evaluations_insertion_update on public.evaluations_insertion for update using (public.is_fondateur() or public.peut_modifier('evaluations_insertion', organisation_id));
create policy evaluations_insertion_delete on public.evaluations_insertion for delete using (public.is_fondateur() or public.peut_supprimer('evaluations_insertion', organisation_id));
