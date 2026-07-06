-- Étape 8 — Formations & Classes (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 10
-- Réutilise classes_groupes (Étape 6), ne la recrée pas. Migration additive uniquement.

create table if not exists public.formations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  titre text not null,
  description text,
  niveau text,
  duree_heures int,
  statut text not null default 'brouillon' check (statut in ('brouillon','publiee','archivee')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cours (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  titre text not null,
  description text,
  ordre int,
  duree_minutes int,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ressources_cours (
  id uuid primary key default gen_random_uuid(),
  cours_id uuid not null references public.cours(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type_ressource text check (type_ressource in ('video','audio','document','lien')),
  titre text,
  url_fichier text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competences (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text,
  nom text not null,
  description text,
  niveau_requis text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preuves_competences (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  competence_id uuid not null references public.competences(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  description text,
  url_fichier text,
  date_obtention date not null default current_date,
  valide boolean not null default false,
  valide_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz (
  id uuid primary key default gen_random_uuid(),
  cours_id uuid not null references public.cours(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  titre text not null,
  description text,
  note_maximale numeric not null default 20,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions_quiz (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quiz(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  enonce text not null,
  type_question text not null default 'choix_unique' check (type_question in ('choix_unique','choix_multiple','texte_libre')),
  points numeric not null default 1,
  ordre int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resultats_quiz (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quiz(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  score numeric,
  date_passage timestamptz not null default now(),
  reponses jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devoirs (
  id uuid primary key default gen_random_uuid(),
  cours_id uuid not null references public.cours(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  titre text not null,
  description text,
  date_limite date,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.soumissions_devoirs (
  id uuid primary key default gen_random_uuid(),
  devoir_id uuid not null references public.devoirs(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  contenu text,
  url_fichier text,
  date_soumission timestamptz not null default now(),
  note numeric,
  evalue_par uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- index
create index if not exists idx_formations_organisation_id on public.formations(organisation_id);
create index if not exists idx_cours_formation_id on public.cours(formation_id);
create index if not exists idx_cours_organisation_id on public.cours(organisation_id);
create index if not exists idx_ressources_cours_cours_id on public.ressources_cours(cours_id);
create index if not exists idx_competences_organisation_id on public.competences(organisation_id);
create index if not exists idx_preuves_competences_beneficiaire_id on public.preuves_competences(beneficiaire_id);
create index if not exists idx_preuves_competences_competence_id on public.preuves_competences(competence_id);
create index if not exists idx_quiz_cours_id on public.quiz(cours_id);
create index if not exists idx_questions_quiz_quiz_id on public.questions_quiz(quiz_id);
create index if not exists idx_resultats_quiz_quiz_id on public.resultats_quiz(quiz_id);
create index if not exists idx_resultats_quiz_beneficiaire_id on public.resultats_quiz(beneficiaire_id);
create index if not exists idx_devoirs_cours_id on public.devoirs(cours_id);
create index if not exists idx_soumissions_devoirs_devoir_id on public.soumissions_devoirs(devoir_id);
create index if not exists idx_soumissions_devoirs_beneficiaire_id on public.soumissions_devoirs(beneficiaire_id);

-- triggers
create trigger set_updated_at before update on public.formations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.cours for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.ressources_cours for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.competences for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.preuves_competences for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.quiz for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.questions_quiz for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.resultats_quiz for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.devoirs for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.soumissions_devoirs for each row execute function public.set_updated_at();

create trigger audit_formations after insert or update or delete on public.formations for each row execute function public.log_audit();
create trigger audit_competences after insert or update or delete on public.competences for each row execute function public.log_audit();
create trigger audit_preuves_competences after insert or update or delete on public.preuves_competences for each row execute function public.log_audit();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','formations', true, true, true, true),
  ('fondateur','cours', true, true, true, true),
  ('fondateur','ressources_cours', true, true, true, true),
  ('fondateur','competences', true, true, true, true),
  ('fondateur','preuves_competences', true, true, true, true),
  ('fondateur','quiz', true, true, true, true),
  ('fondateur','questions_quiz', true, true, true, true),
  ('fondateur','resultats_quiz', true, true, true, true),
  ('fondateur','devoirs', true, true, true, true),
  ('fondateur','soumissions_devoirs', true, true, true, true),
  ('administrateur','formations', true, true, true, false),
  ('administrateur','competences', true, true, true, false),
  ('coordinateur','formations', true, true, true, false),
  ('coordinateur','competences', true, true, true, false),
  ('educateur','formations', true, false, false, false),
  ('educateur','preuves_competences', true, true, true, false),
  ('formateur','formations', true, true, true, false),
  ('formateur','cours', true, true, true, false),
  ('formateur','ressources_cours', true, true, true, false),
  ('formateur','quiz', true, true, true, false),
  ('formateur','questions_quiz', true, true, true, false),
  ('formateur','resultats_quiz', true, true, true, false),
  ('formateur','devoirs', true, true, true, false),
  ('formateur','soumissions_devoirs', true, true, true, false),
  ('formateur','preuves_competences', true, true, true, false),
  ('enseignant','cours', true, true, true, false),
  ('enseignant','quiz', true, true, true, false),
  ('enseignant','devoirs', true, true, true, false),
  ('enseignant','soumissions_devoirs', true, true, true, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.formations enable row level security;
alter table public.cours enable row level security;
alter table public.ressources_cours enable row level security;
alter table public.competences enable row level security;
alter table public.preuves_competences enable row level security;
alter table public.quiz enable row level security;
alter table public.questions_quiz enable row level security;
alter table public.resultats_quiz enable row level security;
alter table public.devoirs enable row level security;
alter table public.soumissions_devoirs enable row level security;

create policy formations_select on public.formations for select using (public.is_fondateur() or public.peut_lire('formations', organisation_id));
create policy formations_insert on public.formations for insert with check (public.is_fondateur() or public.peut_creer('formations', organisation_id));
create policy formations_update on public.formations for update using (public.is_fondateur() or public.peut_modifier('formations', organisation_id));
create policy formations_delete on public.formations for delete using (public.is_fondateur() or public.peut_supprimer('formations', organisation_id));

create policy cours_select on public.cours for select using (public.is_fondateur() or public.peut_lire('cours', organisation_id));
create policy cours_insert on public.cours for insert with check (public.is_fondateur() or public.peut_creer('cours', organisation_id));
create policy cours_update on public.cours for update using (public.is_fondateur() or public.peut_modifier('cours', organisation_id));
create policy cours_delete on public.cours for delete using (public.is_fondateur() or public.peut_supprimer('cours', organisation_id));

create policy ressources_cours_select on public.ressources_cours for select using (public.is_fondateur() or public.peut_lire('ressources_cours', organisation_id));
create policy ressources_cours_insert on public.ressources_cours for insert with check (public.is_fondateur() or public.peut_creer('ressources_cours', organisation_id));
create policy ressources_cours_update on public.ressources_cours for update using (public.is_fondateur() or public.peut_modifier('ressources_cours', organisation_id));
create policy ressources_cours_delete on public.ressources_cours for delete using (public.is_fondateur() or public.peut_supprimer('ressources_cours', organisation_id));

create policy competences_select on public.competences for select using (public.is_fondateur() or public.peut_lire('competences', organisation_id));
create policy competences_insert on public.competences for insert with check (public.is_fondateur() or public.peut_creer('competences', organisation_id));
create policy competences_update on public.competences for update using (public.is_fondateur() or public.peut_modifier('competences', organisation_id));
create policy competences_delete on public.competences for delete using (public.is_fondateur() or public.peut_supprimer('competences', organisation_id));

create policy preuves_competences_select on public.preuves_competences for select using (public.is_fondateur() or public.peut_lire('preuves_competences', organisation_id));
create policy preuves_competences_insert on public.preuves_competences for insert with check (public.is_fondateur() or public.peut_creer('preuves_competences', organisation_id));
create policy preuves_competences_update on public.preuves_competences for update using (public.is_fondateur() or public.peut_modifier('preuves_competences', organisation_id));
create policy preuves_competences_delete on public.preuves_competences for delete using (public.is_fondateur() or public.peut_supprimer('preuves_competences', organisation_id));

create policy quiz_select on public.quiz for select using (public.is_fondateur() or public.peut_lire('quiz', organisation_id));
create policy quiz_insert on public.quiz for insert with check (public.is_fondateur() or public.peut_creer('quiz', organisation_id));
create policy quiz_update on public.quiz for update using (public.is_fondateur() or public.peut_modifier('quiz', organisation_id));
create policy quiz_delete on public.quiz for delete using (public.is_fondateur() or public.peut_supprimer('quiz', organisation_id));

create policy questions_quiz_select on public.questions_quiz for select using (public.is_fondateur() or public.peut_lire('questions_quiz', organisation_id));
create policy questions_quiz_insert on public.questions_quiz for insert with check (public.is_fondateur() or public.peut_creer('questions_quiz', organisation_id));
create policy questions_quiz_update on public.questions_quiz for update using (public.is_fondateur() or public.peut_modifier('questions_quiz', organisation_id));
create policy questions_quiz_delete on public.questions_quiz for delete using (public.is_fondateur() or public.peut_supprimer('questions_quiz', organisation_id));

create policy resultats_quiz_select on public.resultats_quiz for select using (public.is_fondateur() or public.peut_lire('resultats_quiz', organisation_id));
create policy resultats_quiz_insert on public.resultats_quiz for insert with check (public.is_fondateur() or public.peut_creer('resultats_quiz', organisation_id));
create policy resultats_quiz_update on public.resultats_quiz for update using (public.is_fondateur() or public.peut_modifier('resultats_quiz', organisation_id));
create policy resultats_quiz_delete on public.resultats_quiz for delete using (public.is_fondateur() or public.peut_supprimer('resultats_quiz', organisation_id));

create policy devoirs_select on public.devoirs for select using (public.is_fondateur() or public.peut_lire('devoirs', organisation_id));
create policy devoirs_insert on public.devoirs for insert with check (public.is_fondateur() or public.peut_creer('devoirs', organisation_id));
create policy devoirs_update on public.devoirs for update using (public.is_fondateur() or public.peut_modifier('devoirs', organisation_id));
create policy devoirs_delete on public.devoirs for delete using (public.is_fondateur() or public.peut_supprimer('devoirs', organisation_id));

create policy soumissions_devoirs_select on public.soumissions_devoirs for select using (public.is_fondateur() or public.peut_lire('soumissions_devoirs', organisation_id));
create policy soumissions_devoirs_insert on public.soumissions_devoirs for insert with check (public.is_fondateur() or public.peut_creer('soumissions_devoirs', organisation_id));
create policy soumissions_devoirs_update on public.soumissions_devoirs for update using (public.is_fondateur() or public.peut_modifier('soumissions_devoirs', organisation_id));
create policy soumissions_devoirs_delete on public.soumissions_devoirs for delete using (public.is_fondateur() or public.peut_supprimer('soumissions_devoirs', organisation_id));
