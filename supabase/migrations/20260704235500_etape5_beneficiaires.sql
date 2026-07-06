-- Étape 5 — Bénéficiaires (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 7
-- Données sensibles (potentiellement des mineurs) : RLS stricte dès la création,
-- pas de fonctionnalité de partage public. Migration additive uniquement.

-- ============================================================================
-- T1 — beneficiaires (table centrale)
-- Pas de score_iga_actuel/capital_social/statut_insertion ici (tables dediees
-- versionnees a venir, cf. DECISIONS_LOG.md). Pas de colonne d'age (principe
-- absolu section 2 : jamais stocke, toujours calcule).
-- ============================================================================
create table if not exists public.beneficiaires (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  nom text not null,
  prenoms text not null,
  sexe text not null default 'non_renseigne' check (sexe in ('masculin','feminin','non_renseigne')),
  date_naissance date,
  photo_url text,
  telephone text,
  email text,
  adresse text,
  pays text,
  ville text,
  situation_familiale text,
  sante text,
  handicap boolean not null default false,
  handicap_details text,
  niveau_etude text,
  formation_actuelle text,
  statut_beneficiaire text not null default 'actif' check (statut_beneficiaire in ('actif','inactif','suspendu','sorti')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T2 — calcul d'age a la demande (jamais stocke)
-- ============================================================================
create or replace function public.calculer_age(p_date_naissance date)
returns int
language sql
immutable
as $$
  select case when p_date_naissance is null then null
    else date_part('year', age(current_date, p_date_naissance))::int
  end;
$$;

-- ============================================================================
-- T3 — parents_tuteurs
-- ============================================================================
create table if not exists public.parents_tuteurs (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  nom text,
  prenoms text,
  lien_parente text check (lien_parente in ('pere','mere','tuteur_legal','autre')),
  telephone text,
  email text,
  adresse text,
  est_contact_urgence boolean not null default false,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T4 — mentors
-- ============================================================================
create table if not exists public.mentors (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  nom text,
  prenoms text,
  telephone text,
  email text,
  profession text,
  structure_origine text,
  date_debut date not null default current_date,
  date_fin date,
  statut text not null default 'actif' check (statut in ('actif','inactif')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T5 — documents_beneficiaires (aucun partage public, RLS uniquement)
-- ============================================================================
create table if not exists public.documents_beneficiaires (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type_document text,
  nom_fichier text,
  url_fichier text,
  taille_ko int,
  televerse_par uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T6 — dossiers_beneficiaires (synthese, 1:1)
-- ============================================================================
create table if not exists public.dossiers_beneficiaires (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null unique references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  resume_situation text,
  objectifs_generaux text,
  statut_dossier text not null default 'ouvert' check (statut_dossier in ('ouvert','en_cours','cloture')),
  date_ouverture date not null default current_date,
  date_cloture date,
  cloture_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Index, triggers, seed permissions
-- ============================================================================
create index if not exists idx_beneficiaires_organisation_id on public.beneficiaires(organisation_id);
create index if not exists idx_beneficiaires_profile_id on public.beneficiaires(profile_id);
create index if not exists idx_parents_tuteurs_beneficiaire_id on public.parents_tuteurs(beneficiaire_id);
create index if not exists idx_parents_tuteurs_organisation_id on public.parents_tuteurs(organisation_id);
create index if not exists idx_mentors_beneficiaire_id on public.mentors(beneficiaire_id);
create index if not exists idx_mentors_organisation_id on public.mentors(organisation_id);
create index if not exists idx_documents_beneficiaires_beneficiaire_id on public.documents_beneficiaires(beneficiaire_id);
create index if not exists idx_documents_beneficiaires_organisation_id on public.documents_beneficiaires(organisation_id);
create index if not exists idx_dossiers_beneficiaires_beneficiaire_id on public.dossiers_beneficiaires(beneficiaire_id);
create index if not exists idx_dossiers_beneficiaires_organisation_id on public.dossiers_beneficiaires(organisation_id);

create trigger set_updated_at before update on public.beneficiaires
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.parents_tuteurs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.mentors
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.documents_beneficiaires
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.dossiers_beneficiaires
  for each row execute function public.set_updated_at();

create trigger audit_beneficiaires after insert or update or delete on public.beneficiaires
  for each row execute function public.log_audit();
create trigger audit_parents_tuteurs after insert or update or delete on public.parents_tuteurs
  for each row execute function public.log_audit();
create trigger audit_mentors after insert or update or delete on public.mentors
  for each row execute function public.log_audit();
create trigger audit_documents_beneficiaires after insert or update or delete on public.documents_beneficiaires
  for each row execute function public.log_audit();
create trigger audit_dossiers_beneficiaires after insert or update or delete on public.dossiers_beneficiaires
  for each row execute function public.log_audit();

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','beneficiaires', true, true, true, true),
  ('fondateur','parents_tuteurs', true, true, true, true),
  ('fondateur','mentors', true, true, true, true),
  ('fondateur','documents_beneficiaires', true, true, true, true),
  ('fondateur','dossiers_beneficiaires', true, true, true, true),
  ('administrateur','beneficiaires', true, true, true, false),
  ('administrateur','parents_tuteurs', true, true, true, false),
  ('administrateur','mentors', true, true, true, false),
  ('administrateur','documents_beneficiaires', true, true, true, false),
  ('administrateur','dossiers_beneficiaires', true, true, true, false),
  ('directeur','beneficiaires', true, true, true, false),
  ('coordinateur','beneficiaires', true, true, true, false),
  ('educateur','beneficiaires', true, true, true, false),
  ('educateur','dossiers_beneficiaires', true, true, true, false),
  ('formateur','beneficiaires', true, false, true, false),
  ('psychologue','beneficiaires', true, true, true, false),
  ('psychologue','dossiers_beneficiaires', true, true, true, false),
  ('assistant_social','beneficiaires', true, true, true, false),
  ('assistant_social','dossiers_beneficiaires', true, true, true, false),
  ('beneficiaire','beneficiaires', false, false, false, false)
on conflict (role, module) do nothing;
-- NB securite : peut_lire=false pour ('beneficiaire','beneficiaires') est deliberement
-- restrictif. L'acces d'un beneficiaire a SA PROPRE fiche passe exclusivement par la
-- clause "profile_id = auth.uid()" de la policy beneficiaires_select, jamais par la
-- matrice de permissions (qui est scopee a TOUTE l'organisation, pas a une ligne).
-- Mettre peut_lire=true ici redonnerait acces a tous les beneficiaires de l'organisation
-- via public.peut_lire('beneficiaires', organisation_id) -- bug de securite reel detecte
-- et corrige lors du test de cloisonnement de l'Etape 5, cf. DECISIONS_LOG.md.

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.beneficiaires enable row level security;
alter table public.parents_tuteurs enable row level security;
alter table public.mentors enable row level security;
alter table public.documents_beneficiaires enable row level security;
alter table public.dossiers_beneficiaires enable row level security;

-- beneficiaires : lecture = membre autorise de l'organisation OU le beneficiaire lui-meme (sa PROPRE ligne uniquement)
create policy beneficiaires_select on public.beneficiaires
  for select using (
    public.is_fondateur()
    or public.peut_lire('beneficiaires', organisation_id)
    or profile_id = auth.uid()
  );
create policy beneficiaires_insert on public.beneficiaires
  for insert with check (public.is_fondateur() or public.peut_creer('beneficiaires', organisation_id));
create policy beneficiaires_update on public.beneficiaires
  for update using (public.is_fondateur() or public.peut_modifier('beneficiaires', organisation_id));
create policy beneficiaires_delete on public.beneficiaires
  for delete using (public.is_fondateur() or public.peut_supprimer('beneficiaires', organisation_id));

-- parents_tuteurs : cote professionnel uniquement, scoping organisation
create policy parents_tuteurs_select on public.parents_tuteurs
  for select using (public.is_fondateur() or public.peut_lire('parents_tuteurs', organisation_id));
create policy parents_tuteurs_insert on public.parents_tuteurs
  for insert with check (public.is_fondateur() or public.peut_creer('parents_tuteurs', organisation_id));
create policy parents_tuteurs_update on public.parents_tuteurs
  for update using (public.is_fondateur() or public.peut_modifier('parents_tuteurs', organisation_id));
create policy parents_tuteurs_delete on public.parents_tuteurs
  for delete using (public.is_fondateur() or public.peut_supprimer('parents_tuteurs', organisation_id));

-- mentors
create policy mentors_select on public.mentors
  for select using (public.is_fondateur() or public.peut_lire('mentors', organisation_id));
create policy mentors_insert on public.mentors
  for insert with check (public.is_fondateur() or public.peut_creer('mentors', organisation_id));
create policy mentors_update on public.mentors
  for update using (public.is_fondateur() or public.peut_modifier('mentors', organisation_id));
create policy mentors_delete on public.mentors
  for delete using (public.is_fondateur() or public.peut_supprimer('mentors', organisation_id));

-- documents_beneficiaires : aucun acces sans authentification (pas de policy pour anon, RLS sans exception)
create policy documents_beneficiaires_select on public.documents_beneficiaires
  for select using (public.is_fondateur() or public.peut_lire('documents_beneficiaires', organisation_id));
create policy documents_beneficiaires_insert on public.documents_beneficiaires
  for insert with check (public.is_fondateur() or public.peut_creer('documents_beneficiaires', organisation_id));
create policy documents_beneficiaires_update on public.documents_beneficiaires
  for update using (public.is_fondateur() or public.peut_modifier('documents_beneficiaires', organisation_id));
create policy documents_beneficiaires_delete on public.documents_beneficiaires
  for delete using (public.is_fondateur() or public.peut_supprimer('documents_beneficiaires', organisation_id));

-- dossiers_beneficiaires
create policy dossiers_beneficiaires_select on public.dossiers_beneficiaires
  for select using (public.is_fondateur() or public.peut_lire('dossiers_beneficiaires', organisation_id));
create policy dossiers_beneficiaires_insert on public.dossiers_beneficiaires
  for insert with check (public.is_fondateur() or public.peut_creer('dossiers_beneficiaires', organisation_id));
create policy dossiers_beneficiaires_update on public.dossiers_beneficiaires
  for update using (public.is_fondateur() or public.peut_modifier('dossiers_beneficiaires', organisation_id));
create policy dossiers_beneficiaires_delete on public.dossiers_beneficiaires
  for delete using (public.is_fondateur() or public.peut_supprimer('dossiers_beneficiaires', organisation_id));
