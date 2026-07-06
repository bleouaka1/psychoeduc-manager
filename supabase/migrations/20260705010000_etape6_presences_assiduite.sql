-- Étape 6 — Présences & Assiduité (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 8
-- Migration additive uniquement.

create table if not exists public.classes_groupes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  nom text not null,
  niveau text,
  effectif_max int,
  annee_scolaire text,
  responsable_membre_organisation_id uuid references public.membres_organisations(id) on delete set null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inscriptions_classes (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classes_groupes(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  date_inscription date not null default current_date,
  statut text not null default 'active' check (statut in ('active','terminee','transferee')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (classe_id, beneficiaire_id)
);

create table if not exists public.presences (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classes_groupes(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  date_seance date not null,
  statut text not null default 'present' check (statut in ('present','absent','retard')),
  heure_arrivee time,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (classe_id, beneficiaire_id, date_seance)
);

create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  presence_id uuid not null references public.presences(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  motif text,
  justifiee boolean not null default false,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.retards (
  id uuid primary key default gen_random_uuid(),
  presence_id uuid not null references public.presences(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  duree_minutes int,
  motif text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.justifications_absence (
  id uuid primary key default gen_random_uuid(),
  absence_id uuid not null references public.absences(id) on delete cascade,
  document_url text,
  motif text,
  soumis_par uuid references public.profiles(id),
  statut text not null default 'en_attente' check (statut in ('en_attente','acceptee','refusee')),
  traite_par uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alertes_assiduite (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type_alerte text check (type_alerte in ('absences_repetees','retards_frequents','absence_prolongee')),
  seuil_declenche text,
  statut text not null default 'active' check (statut in ('active','traitee','ignoree')),
  traite_par uuid references public.profiles(id),
  traite_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- index
create index if not exists idx_classes_groupes_organisation_id on public.classes_groupes(organisation_id);
create index if not exists idx_inscriptions_classes_classe_id on public.inscriptions_classes(classe_id);
create index if not exists idx_inscriptions_classes_beneficiaire_id on public.inscriptions_classes(beneficiaire_id);
create index if not exists idx_inscriptions_classes_organisation_id on public.inscriptions_classes(organisation_id);
create index if not exists idx_presences_classe_id on public.presences(classe_id);
create index if not exists idx_presences_beneficiaire_id on public.presences(beneficiaire_id);
create index if not exists idx_presences_organisation_id on public.presences(organisation_id);
create index if not exists idx_absences_presence_id on public.absences(presence_id);
create index if not exists idx_absences_organisation_id on public.absences(organisation_id);
create index if not exists idx_retards_presence_id on public.retards(presence_id);
create index if not exists idx_retards_organisation_id on public.retards(organisation_id);
create index if not exists idx_justifications_absence_absence_id on public.justifications_absence(absence_id);
create index if not exists idx_alertes_assiduite_beneficiaire_id on public.alertes_assiduite(beneficiaire_id);
create index if not exists idx_alertes_assiduite_organisation_id on public.alertes_assiduite(organisation_id);

-- triggers
create trigger set_updated_at before update on public.classes_groupes for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.inscriptions_classes for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.presences for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.absences for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.retards for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.justifications_absence for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.alertes_assiduite for each row execute function public.set_updated_at();

create trigger audit_classes_groupes after insert or update or delete on public.classes_groupes for each row execute function public.log_audit();
create trigger audit_inscriptions_classes after insert or update or delete on public.inscriptions_classes for each row execute function public.log_audit();
create trigger audit_presences after insert or update or delete on public.presences for each row execute function public.log_audit();
create trigger audit_absences after insert or update or delete on public.absences for each row execute function public.log_audit();

-- seed permissions (jamais peut_lire=true pour 'beneficiaire' ici, module non expose au beneficiaire pour l'instant)
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','classes_groupes', true, true, true, true),
  ('fondateur','inscriptions_classes', true, true, true, true),
  ('fondateur','presences', true, true, true, true),
  ('fondateur','absences', true, true, true, true),
  ('fondateur','retards', true, true, true, true),
  ('fondateur','justifications_absence', true, true, true, true),
  ('fondateur','alertes_assiduite', true, true, true, true),
  ('administrateur','classes_groupes', true, true, true, false),
  ('administrateur','inscriptions_classes', true, true, true, false),
  ('administrateur','presences', true, true, true, false),
  ('administrateur','absences', true, true, true, false),
  ('administrateur','alertes_assiduite', true, false, true, false),
  ('directeur','classes_groupes', true, false, false, false),
  ('directeur','alertes_assiduite', true, false, true, false),
  ('coordinateur','classes_groupes', true, true, true, false),
  ('coordinateur','inscriptions_classes', true, true, true, false),
  ('coordinateur','alertes_assiduite', true, false, true, false),
  ('educateur','presences', true, true, true, false),
  ('educateur','absences', true, true, true, false),
  ('educateur','retards', true, true, true, false),
  ('educateur','justifications_absence', true, true, true, false),
  ('formateur','presences', true, true, true, false),
  ('formateur','absences', true, true, false, false),
  ('formateur','retards', true, true, false, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.classes_groupes enable row level security;
alter table public.inscriptions_classes enable row level security;
alter table public.presences enable row level security;
alter table public.absences enable row level security;
alter table public.retards enable row level security;
alter table public.justifications_absence enable row level security;
alter table public.alertes_assiduite enable row level security;

create policy classes_groupes_select on public.classes_groupes for select using (public.is_fondateur() or public.peut_lire('classes_groupes', organisation_id));
create policy classes_groupes_insert on public.classes_groupes for insert with check (public.is_fondateur() or public.peut_creer('classes_groupes', organisation_id));
create policy classes_groupes_update on public.classes_groupes for update using (public.is_fondateur() or public.peut_modifier('classes_groupes', organisation_id));
create policy classes_groupes_delete on public.classes_groupes for delete using (public.is_fondateur() or public.peut_supprimer('classes_groupes', organisation_id));

create policy inscriptions_classes_select on public.inscriptions_classes for select using (public.is_fondateur() or public.peut_lire('inscriptions_classes', organisation_id));
create policy inscriptions_classes_insert on public.inscriptions_classes for insert with check (public.is_fondateur() or public.peut_creer('inscriptions_classes', organisation_id));
create policy inscriptions_classes_update on public.inscriptions_classes for update using (public.is_fondateur() or public.peut_modifier('inscriptions_classes', organisation_id));
create policy inscriptions_classes_delete on public.inscriptions_classes for delete using (public.is_fondateur() or public.peut_supprimer('inscriptions_classes', organisation_id));

create policy presences_select on public.presences for select using (public.is_fondateur() or public.peut_lire('presences', organisation_id));
create policy presences_insert on public.presences for insert with check (public.is_fondateur() or public.peut_creer('presences', organisation_id));
create policy presences_update on public.presences for update using (public.is_fondateur() or public.peut_modifier('presences', organisation_id));
create policy presences_delete on public.presences for delete using (public.is_fondateur() or public.peut_supprimer('presences', organisation_id));

create policy absences_select on public.absences for select using (public.is_fondateur() or public.peut_lire('absences', organisation_id));
create policy absences_insert on public.absences for insert with check (public.is_fondateur() or public.peut_creer('absences', organisation_id));
create policy absences_update on public.absences for update using (public.is_fondateur() or public.peut_modifier('absences', organisation_id));
create policy absences_delete on public.absences for delete using (public.is_fondateur() or public.peut_supprimer('absences', organisation_id));

create policy retards_select on public.retards for select using (public.is_fondateur() or public.peut_lire('retards', organisation_id));
create policy retards_insert on public.retards for insert with check (public.is_fondateur() or public.peut_creer('retards', organisation_id));
create policy retards_update on public.retards for update using (public.is_fondateur() or public.peut_modifier('retards', organisation_id));
create policy retards_delete on public.retards for delete using (public.is_fondateur() or public.peut_supprimer('retards', organisation_id));

create policy justifications_absence_select on public.justifications_absence for select using (
  public.is_fondateur() or exists (select 1 from public.absences a where a.id = justifications_absence.absence_id and public.peut_lire('justifications_absence', a.organisation_id))
);
create policy justifications_absence_insert on public.justifications_absence for insert with check (
  public.is_fondateur() or exists (select 1 from public.absences a where a.id = absence_id and public.peut_creer('justifications_absence', a.organisation_id))
);
create policy justifications_absence_update on public.justifications_absence for update using (
  public.is_fondateur() or exists (select 1 from public.absences a where a.id = justifications_absence.absence_id and public.peut_modifier('justifications_absence', a.organisation_id))
);

create policy alertes_assiduite_select on public.alertes_assiduite for select using (public.is_fondateur() or public.peut_lire('alertes_assiduite', organisation_id));
create policy alertes_assiduite_insert on public.alertes_assiduite for insert with check (public.is_fondateur() or public.peut_creer('alertes_assiduite', organisation_id));
create policy alertes_assiduite_update on public.alertes_assiduite for update using (public.is_fondateur() or public.peut_modifier('alertes_assiduite', organisation_id));
