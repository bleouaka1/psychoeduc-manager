-- Étape 9 — IGA : Indice Général d'Autonomie (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 11
-- Données sensibles (évaluations de bénéficiaires, potentiellement mineurs).
-- Leçon de l'Étape 5 appliquée dès le départ : le rôle 'beneficiaire' n'a JAMAIS
-- peut_lire=true org-large sur les modules IGA ; son accès passe par des clauses
-- RLS dédiées restreintes à ses propres lignes. Migration additive uniquement.

-- ============================================================================
-- T1 — referentiels_iga (un seul actif a la fois)
-- ============================================================================
create table if not exists public.referentiels_iga (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  date_effet date not null default current_date,
  description text,
  actif boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_referentiels_iga_un_seul_actif
  on public.referentiels_iga((true))
  where (actif = true);

insert into public.referentiels_iga (version, date_effet, description, actif)
values (1, current_date, 'Référentiel IGA initial — 12 dimensions officielles (architecture v5)', true)
on conflict (version) do nothing;

-- ============================================================================
-- T2 — dimensions_iga (12 dimensions officielles, seed pour le referentiel v1)
-- ============================================================================
create table if not exists public.dimensions_iga (
  id uuid primary key default gen_random_uuid(),
  referentiel_id uuid not null references public.referentiels_iga(id) on delete cascade,
  code text not null,
  nom text not null,
  description text,
  ordre int,
  poids numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (referentiel_id, code)
);

insert into public.dimensions_iga (referentiel_id, code, nom, ordre)
select r.id, d.code, d.nom, d.ordre
from public.referentiels_iga r
cross join (values
  ('projet_de_vie','Projet de vie',1),
  ('discipline','Discipline',2),
  ('competences_techniques','Compétences techniques',3),
  ('competences_cognitives','Compétences cognitives',4),
  ('competences_socio_affectives','Compétences socio-affectives',5),
  ('capital_social','Capital social',6),
  ('employabilite','Employabilité',7),
  ('autonomie_economique','Autonomie économique',8),
  ('sante_hygiene','Santé et hygiène',9),
  ('citoyennete','Citoyenneté',10),
  ('innovation','Innovation',11),
  ('resilience','Résilience',12)
) as d(code, nom, ordre)
where r.version = 1
on conflict (referentiel_id, code) do nothing;

-- ============================================================================
-- T3 — criteres_iga
-- ============================================================================
create table if not exists public.criteres_iga (
  id uuid primary key default gen_random_uuid(),
  dimension_id uuid not null references public.dimensions_iga(id) on delete cascade,
  code text,
  libelle text not null,
  description text,
  poids numeric not null default 1,
  ordre int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T4 — evaluations_iga (referentiel_version_id obligatoire, cf. decision T1)
-- ============================================================================
create table if not exists public.evaluations_iga (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  referentiel_version_id uuid not null references public.referentiels_iga(id),
  evalue_par uuid references public.profiles(id),
  date_evaluation date not null default current_date,
  score_global numeric check (score_global between 0 and 100),
  niveau text check (niveau in ('dependance','autonomie_emergente','autonomie_fonctionnelle','autonomie_avancee','leadership_autonome')),
  commentaire text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T5 — scores_iga, indicateurs_iga, preuves_iga, recommandations_iga
-- ============================================================================
create table if not exists public.scores_iga (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations_iga(id) on delete cascade,
  dimension_id uuid not null references public.dimensions_iga(id),
  score numeric not null check (score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evaluation_id, dimension_id)
);

create table if not exists public.indicateurs_iga (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations_iga(id) on delete cascade,
  critere_id uuid not null references public.criteres_iga(id),
  valeur numeric,
  note_sur_20 numeric check (note_sur_20 between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preuves_iga (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations_iga(id) on delete cascade,
  indicateur_id uuid references public.indicateurs_iga(id) on delete set null,
  type_preuve text,
  url_fichier text,
  description text,
  televerse_par uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recommandations_iga (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations_iga(id) on delete cascade,
  dimension_id uuid references public.dimensions_iga(id),
  recommandation text not null,
  priorite text not null default 'moyenne' check (priorite in ('haute','moyenne','basse')),
  statut text not null default 'proposee' check (statut in ('proposee','en_cours','realisee','abandonnee')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T6 — historique_iga (une entree mensuelle par beneficiaire)
-- ============================================================================
create table if not exists public.historique_iga (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  mois date not null,
  score_global numeric,
  niveau text,
  referentiel_version_id uuid references public.referentiels_iga(id),
  created_at timestamptz not null default now(),
  unique (beneficiaire_id, mois)
);

-- ============================================================================
-- T7 — classements_iga + vue top100_iga (jamais de table dupliquee)
-- ============================================================================
create table if not exists public.classements_iga (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  periode_type text not null check (periode_type in ('mensuel','annuel')),
  periode date not null,
  rang int not null,
  score_global numeric,
  created_at timestamptz not null default now()
);

create or replace view public.top100_iga
with (security_invoker = true) as
select * from public.classements_iga where rang <= 100;

-- ============================================================================
-- T8 — index, triggers, seed permissions
-- ============================================================================
create index if not exists idx_dimensions_iga_referentiel_id on public.dimensions_iga(referentiel_id);
create index if not exists idx_criteres_iga_dimension_id on public.criteres_iga(dimension_id);
create index if not exists idx_evaluations_iga_beneficiaire_id on public.evaluations_iga(beneficiaire_id);
create index if not exists idx_evaluations_iga_organisation_id on public.evaluations_iga(organisation_id);
create index if not exists idx_evaluations_iga_referentiel_version_id on public.evaluations_iga(referentiel_version_id);
create index if not exists idx_scores_iga_evaluation_id on public.scores_iga(evaluation_id);
create index if not exists idx_scores_iga_dimension_id on public.scores_iga(dimension_id);
create index if not exists idx_indicateurs_iga_evaluation_id on public.indicateurs_iga(evaluation_id);
create index if not exists idx_indicateurs_iga_critere_id on public.indicateurs_iga(critere_id);
create index if not exists idx_preuves_iga_evaluation_id on public.preuves_iga(evaluation_id);
create index if not exists idx_recommandations_iga_evaluation_id on public.recommandations_iga(evaluation_id);
create index if not exists idx_historique_iga_beneficiaire_id on public.historique_iga(beneficiaire_id);
create index if not exists idx_historique_iga_organisation_id on public.historique_iga(organisation_id);
create index if not exists idx_classements_iga_organisation_id on public.classements_iga(organisation_id);
create index if not exists idx_classements_iga_beneficiaire_id on public.classements_iga(beneficiaire_id);

create trigger set_updated_at before update on public.referentiels_iga
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.dimensions_iga
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.criteres_iga
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.evaluations_iga
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.scores_iga
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.indicateurs_iga
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.preuves_iga
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.recommandations_iga
  for each row execute function public.set_updated_at();

create trigger audit_referentiels_iga after insert or update or delete on public.referentiels_iga
  for each row execute function public.log_audit();
create trigger audit_evaluations_iga after insert or update or delete on public.evaluations_iga
  for each row execute function public.log_audit();
create trigger audit_scores_iga after insert or update or delete on public.scores_iga
  for each row execute function public.log_audit();
create trigger audit_recommandations_iga after insert or update or delete on public.recommandations_iga
  for each row execute function public.log_audit();

-- seed permissions : JAMAIS peut_lire=true pour 'beneficiaire' sur ces modules (cf. Etape 5)
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','referentiels_iga', true, true, true, true),
  ('fondateur','evaluations_iga', true, true, true, true),
  ('fondateur','scores_iga', true, true, true, true),
  ('fondateur','classements_iga', true, true, true, true),
  ('fondateur','recommandations_iga', true, true, true, true),
  ('administrateur','evaluations_iga', true, true, true, false),
  ('administrateur','scores_iga', true, true, true, false),
  ('administrateur','classements_iga', true, false, false, false),
  ('directeur','evaluations_iga', true, false, false, false),
  ('coordinateur','evaluations_iga', true, true, true, false),
  ('educateur','evaluations_iga', true, true, true, false),
  ('educateur','recommandations_iga', true, true, true, false),
  ('formateur','evaluations_iga', true, true, true, false),
  ('psychologue','evaluations_iga', true, true, true, false),
  ('psychologue','recommandations_iga', true, true, true, false),
  ('assistant_social','evaluations_iga', true, true, true, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.referentiels_iga enable row level security;
alter table public.dimensions_iga enable row level security;
alter table public.criteres_iga enable row level security;
alter table public.evaluations_iga enable row level security;
alter table public.scores_iga enable row level security;
alter table public.indicateurs_iga enable row level security;
alter table public.preuves_iga enable row level security;
alter table public.recommandations_iga enable row level security;
alter table public.historique_iga enable row level security;
alter table public.classements_iga enable row level security;

-- referentiels/dimensions/criteres : tables de reference globales, lecture ouverte a tout authentifie
create policy referentiels_iga_select on public.referentiels_iga
  for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy referentiels_iga_write on public.referentiels_iga
  for all using (public.is_fondateur()) with check (public.is_fondateur());

create policy dimensions_iga_select on public.dimensions_iga
  for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy dimensions_iga_write on public.dimensions_iga
  for all using (public.is_fondateur()) with check (public.is_fondateur());

create policy criteres_iga_select on public.criteres_iga
  for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy criteres_iga_write on public.criteres_iga
  for all using (public.is_fondateur()) with check (public.is_fondateur());

-- evaluations_iga : staff org-scope OU le beneficiaire concerne, restreint a SES PROPRES evaluations
create policy evaluations_iga_select on public.evaluations_iga
  for select using (
    public.is_fondateur()
    or public.peut_lire('evaluations_iga', organisation_id)
    or exists (select 1 from public.beneficiaires b where b.id = evaluations_iga.beneficiaire_id and b.profile_id = auth.uid())
  );
create policy evaluations_iga_insert on public.evaluations_iga
  for insert with check (public.is_fondateur() or public.peut_creer('evaluations_iga', organisation_id));
create policy evaluations_iga_update on public.evaluations_iga
  for update using (public.is_fondateur() or public.peut_modifier('evaluations_iga', organisation_id));
create policy evaluations_iga_delete on public.evaluations_iga
  for delete using (public.is_fondateur() or public.peut_supprimer('evaluations_iga', organisation_id));

-- scores_iga : meme logique, via l'evaluation parente
create policy scores_iga_select on public.scores_iga
  for select using (
    public.is_fondateur()
    or exists (
      select 1 from public.evaluations_iga e
      where e.id = scores_iga.evaluation_id
        and (
          public.peut_lire('evaluations_iga', e.organisation_id)
          or exists (select 1 from public.beneficiaires b where b.id = e.beneficiaire_id and b.profile_id = auth.uid())
        )
    )
  );
create policy scores_iga_insert on public.scores_iga
  for insert with check (
    public.is_fondateur() or exists (
      select 1 from public.evaluations_iga e where e.id = evaluation_id and public.peut_creer('evaluations_iga', e.organisation_id)
    )
  );
create policy scores_iga_update on public.scores_iga
  for update using (
    public.is_fondateur() or exists (
      select 1 from public.evaluations_iga e where e.id = scores_iga.evaluation_id and public.peut_modifier('evaluations_iga', e.organisation_id)
    )
  );
create policy scores_iga_delete on public.scores_iga
  for delete using (
    public.is_fondateur() or exists (
      select 1 from public.evaluations_iga e where e.id = scores_iga.evaluation_id and public.peut_supprimer('evaluations_iga', e.organisation_id)
    )
  );

-- indicateurs_iga, preuves_iga : reserves au personnel (pas d'acces beneficiaire direct sur le detail)
create policy indicateurs_iga_all on public.indicateurs_iga
  for all using (
    public.is_fondateur() or exists (
      select 1 from public.evaluations_iga e where e.id = indicateurs_iga.evaluation_id and public.peut_lire('evaluations_iga', e.organisation_id)
    )
  ) with check (
    public.is_fondateur() or exists (
      select 1 from public.evaluations_iga e where e.id = evaluation_id and public.peut_creer('evaluations_iga', e.organisation_id)
    )
  );

create policy preuves_iga_all on public.preuves_iga
  for all using (
    public.is_fondateur() or exists (
      select 1 from public.evaluations_iga e where e.id = preuves_iga.evaluation_id and public.peut_lire('evaluations_iga', e.organisation_id)
    )
  ) with check (
    public.is_fondateur() or exists (
      select 1 from public.evaluations_iga e where e.id = evaluation_id and public.peut_creer('evaluations_iga', e.organisation_id)
    )
  );

-- recommandations_iga : staff org-scope OU le beneficiaire concerne (lecture seule pour lui)
create policy recommandations_iga_select on public.recommandations_iga
  for select using (
    public.is_fondateur()
    or exists (
      select 1 from public.evaluations_iga e
      where e.id = recommandations_iga.evaluation_id
        and (
          public.peut_lire('recommandations_iga', e.organisation_id)
          or exists (select 1 from public.beneficiaires b where b.id = e.beneficiaire_id and b.profile_id = auth.uid())
        )
    )
  );
create policy recommandations_iga_insert on public.recommandations_iga
  for insert with check (
    public.is_fondateur() or exists (
      select 1 from public.evaluations_iga e where e.id = evaluation_id and public.peut_creer('recommandations_iga', e.organisation_id)
    )
  );
create policy recommandations_iga_update on public.recommandations_iga
  for update using (
    public.is_fondateur() or exists (
      select 1 from public.evaluations_iga e where e.id = recommandations_iga.evaluation_id and public.peut_modifier('recommandations_iga', e.organisation_id)
    )
  );
create policy recommandations_iga_delete on public.recommandations_iga
  for delete using (
    public.is_fondateur() or exists (
      select 1 from public.evaluations_iga e where e.id = recommandations_iga.evaluation_id and public.peut_supprimer('recommandations_iga', e.organisation_id)
    )
  );

-- historique_iga : staff org-scope OU le beneficiaire lui-meme (sa propre ligne uniquement)
create policy historique_iga_select on public.historique_iga
  for select using (
    public.is_fondateur()
    or public.peut_lire('evaluations_iga', organisation_id)
    or exists (select 1 from public.beneficiaires b where b.id = historique_iga.beneficiaire_id and b.profile_id = auth.uid())
  );

-- classements_iga : staff org-scope voit tout ; un beneficiaire ne voit QUE sa propre ligne (jamais celle d'un pair)
create policy classements_iga_select on public.classements_iga
  for select using (
    public.is_fondateur()
    or (organisation_id is not null and public.peut_lire('classements_iga', organisation_id))
    or exists (select 1 from public.beneficiaires b where b.id = classements_iga.beneficiaire_id and b.profile_id = auth.uid())
  );
