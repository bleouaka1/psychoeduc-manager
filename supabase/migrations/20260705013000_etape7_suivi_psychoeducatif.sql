-- Étape 7 — Suivi psycho-éducatif (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 9
-- Migration additive uniquement.

create table if not exists public.suivis (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type_suivi text,
  description text,
  date_suivi date not null default current_date,
  statut text not null default 'planifie' check (statut in ('planifie','en_cours','termine')),
  responsable_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.objectifs (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  suivi_id uuid references public.suivis(id) on delete set null,
  description text not null,
  date_echeance date,
  statut text not null default 'en_cours' check (statut in ('en_cours','atteint','non_atteint','abandonne')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  suivi_id uuid references public.suivis(id) on delete set null,
  contenu text not null,
  date_observation date not null default current_date,
  observe_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entretiens (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  date_entretien timestamptz not null default now(),
  participants text,
  compte_rendu text,
  mene_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type_incident text,
  description text not null,
  date_incident date not null default current_date,
  gravite text not null default 'mineure' check (gravite in ('mineure','moderee','grave')),
  signale_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sanctions (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete set null,
  type_sanction text,
  description text,
  date_sanction date not null default current_date,
  decidee_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rapports (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type_rapport text,
  contenu text,
  periode_debut date,
  periode_fin date,
  redige_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1:1 avec beneficiaires : un seul projet de vie actif a la fois (cf. DECISIONS_LOG.md,
-- l'Etape 18 Reussites referencera projets_vie.statut='valide' sans ambiguite possible)
create table if not exists public.projets_vie (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null unique references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  titre text,
  description text,
  statut text not null default 'en_construction' check (statut in ('en_construction','valide','en_cours','atteint','abandonne')),
  date_validation date,
  valide_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- index
create index if not exists idx_suivis_beneficiaire_id on public.suivis(beneficiaire_id);
create index if not exists idx_suivis_organisation_id on public.suivis(organisation_id);
create index if not exists idx_objectifs_beneficiaire_id on public.objectifs(beneficiaire_id);
create index if not exists idx_objectifs_organisation_id on public.objectifs(organisation_id);
create index if not exists idx_observations_beneficiaire_id on public.observations(beneficiaire_id);
create index if not exists idx_observations_organisation_id on public.observations(organisation_id);
create index if not exists idx_entretiens_beneficiaire_id on public.entretiens(beneficiaire_id);
create index if not exists idx_entretiens_organisation_id on public.entretiens(organisation_id);
create index if not exists idx_incidents_beneficiaire_id on public.incidents(beneficiaire_id);
create index if not exists idx_incidents_organisation_id on public.incidents(organisation_id);
create index if not exists idx_sanctions_beneficiaire_id on public.sanctions(beneficiaire_id);
create index if not exists idx_sanctions_organisation_id on public.sanctions(organisation_id);
create index if not exists idx_rapports_beneficiaire_id on public.rapports(beneficiaire_id);
create index if not exists idx_rapports_organisation_id on public.rapports(organisation_id);
create index if not exists idx_projets_vie_organisation_id on public.projets_vie(organisation_id);

-- triggers
create trigger set_updated_at before update on public.suivis for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.objectifs for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.observations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.entretiens for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.incidents for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.sanctions for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rapports for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.projets_vie for each row execute function public.set_updated_at();

create trigger audit_suivis after insert or update or delete on public.suivis for each row execute function public.log_audit();
create trigger audit_objectifs after insert or update or delete on public.objectifs for each row execute function public.log_audit();
create trigger audit_entretiens after insert or update or delete on public.entretiens for each row execute function public.log_audit();
create trigger audit_incidents after insert or update or delete on public.incidents for each row execute function public.log_audit();
create trigger audit_sanctions after insert or update or delete on public.sanctions for each row execute function public.log_audit();
create trigger audit_projets_vie after insert or update or delete on public.projets_vie for each row execute function public.log_audit();

-- seed permissions (jamais peut_lire=true pour 'beneficiaire' -- module reserve au personnel a ce stade)
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','suivis', true, true, true, true),
  ('fondateur','objectifs', true, true, true, true),
  ('fondateur','observations', true, true, true, true),
  ('fondateur','entretiens', true, true, true, true),
  ('fondateur','incidents', true, true, true, true),
  ('fondateur','sanctions', true, true, true, true),
  ('fondateur','rapports', true, true, true, true),
  ('fondateur','projets_vie', true, true, true, true),
  ('administrateur','suivis', true, true, true, false),
  ('administrateur','incidents', true, true, true, false),
  ('administrateur','sanctions', true, true, true, false),
  ('administrateur','rapports', true, true, true, false),
  ('administrateur','projets_vie', true, false, true, false),
  ('directeur','incidents', true, false, false, false),
  ('directeur','rapports', true, false, false, false),
  ('coordinateur','suivis', true, true, true, false),
  ('coordinateur','objectifs', true, true, true, false),
  ('coordinateur','incidents', true, true, true, false),
  ('coordinateur','sanctions', true, true, true, false),
  ('coordinateur','projets_vie', true, false, true, false),
  ('educateur','suivis', true, true, true, false),
  ('educateur','objectifs', true, true, true, false),
  ('educateur','observations', true, true, true, false),
  ('educateur','entretiens', true, true, true, false),
  ('educateur','incidents', true, true, false, false),
  ('educateur','projets_vie', true, true, true, false),
  ('psychologue','suivis', true, true, true, false),
  ('psychologue','objectifs', true, true, true, false),
  ('psychologue','observations', true, true, true, false),
  ('psychologue','entretiens', true, true, true, false),
  ('psychologue','rapports', true, true, true, false),
  ('psychologue','projets_vie', true, true, true, false),
  ('assistant_social','suivis', true, true, true, false),
  ('assistant_social','observations', true, true, true, false),
  ('assistant_social','entretiens', true, true, true, false),
  ('assistant_social','incidents', true, true, false, false),
  ('assistant_social','projets_vie', true, true, true, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.suivis enable row level security;
alter table public.objectifs enable row level security;
alter table public.observations enable row level security;
alter table public.entretiens enable row level security;
alter table public.incidents enable row level security;
alter table public.sanctions enable row level security;
alter table public.rapports enable row level security;
alter table public.projets_vie enable row level security;

create policy suivis_select on public.suivis for select using (public.is_fondateur() or public.peut_lire('suivis', organisation_id));
create policy suivis_insert on public.suivis for insert with check (public.is_fondateur() or public.peut_creer('suivis', organisation_id));
create policy suivis_update on public.suivis for update using (public.is_fondateur() or public.peut_modifier('suivis', organisation_id));
create policy suivis_delete on public.suivis for delete using (public.is_fondateur() or public.peut_supprimer('suivis', organisation_id));

create policy objectifs_select on public.objectifs for select using (public.is_fondateur() or public.peut_lire('objectifs', organisation_id));
create policy objectifs_insert on public.objectifs for insert with check (public.is_fondateur() or public.peut_creer('objectifs', organisation_id));
create policy objectifs_update on public.objectifs for update using (public.is_fondateur() or public.peut_modifier('objectifs', organisation_id));
create policy objectifs_delete on public.objectifs for delete using (public.is_fondateur() or public.peut_supprimer('objectifs', organisation_id));

create policy observations_select on public.observations for select using (public.is_fondateur() or public.peut_lire('observations', organisation_id));
create policy observations_insert on public.observations for insert with check (public.is_fondateur() or public.peut_creer('observations', organisation_id));
create policy observations_update on public.observations for update using (public.is_fondateur() or public.peut_modifier('observations', organisation_id));
create policy observations_delete on public.observations for delete using (public.is_fondateur() or public.peut_supprimer('observations', organisation_id));

create policy entretiens_select on public.entretiens for select using (public.is_fondateur() or public.peut_lire('entretiens', organisation_id));
create policy entretiens_insert on public.entretiens for insert with check (public.is_fondateur() or public.peut_creer('entretiens', organisation_id));
create policy entretiens_update on public.entretiens for update using (public.is_fondateur() or public.peut_modifier('entretiens', organisation_id));
create policy entretiens_delete on public.entretiens for delete using (public.is_fondateur() or public.peut_supprimer('entretiens', organisation_id));

create policy incidents_select on public.incidents for select using (public.is_fondateur() or public.peut_lire('incidents', organisation_id));
create policy incidents_insert on public.incidents for insert with check (public.is_fondateur() or public.peut_creer('incidents', organisation_id));
create policy incidents_update on public.incidents for update using (public.is_fondateur() or public.peut_modifier('incidents', organisation_id));
create policy incidents_delete on public.incidents for delete using (public.is_fondateur() or public.peut_supprimer('incidents', organisation_id));

create policy sanctions_select on public.sanctions for select using (public.is_fondateur() or public.peut_lire('sanctions', organisation_id));
create policy sanctions_insert on public.sanctions for insert with check (public.is_fondateur() or public.peut_creer('sanctions', organisation_id));
create policy sanctions_update on public.sanctions for update using (public.is_fondateur() or public.peut_modifier('sanctions', organisation_id));
create policy sanctions_delete on public.sanctions for delete using (public.is_fondateur() or public.peut_supprimer('sanctions', organisation_id));

create policy rapports_select on public.rapports for select using (public.is_fondateur() or public.peut_lire('rapports', organisation_id));
create policy rapports_insert on public.rapports for insert with check (public.is_fondateur() or public.peut_creer('rapports', organisation_id));
create policy rapports_update on public.rapports for update using (public.is_fondateur() or public.peut_modifier('rapports', organisation_id));
create policy rapports_delete on public.rapports for delete using (public.is_fondateur() or public.peut_supprimer('rapports', organisation_id));

create policy projets_vie_select on public.projets_vie for select using (public.is_fondateur() or public.peut_lire('projets_vie', organisation_id));
create policy projets_vie_insert on public.projets_vie for insert with check (public.is_fondateur() or public.peut_creer('projets_vie', organisation_id));
create policy projets_vie_update on public.projets_vie for update using (public.is_fondateur() or public.peut_modifier('projets_vie', organisation_id));
create policy projets_vie_delete on public.projets_vie for delete using (public.is_fondateur() or public.peut_supprimer('projets_vie', organisation_id));
