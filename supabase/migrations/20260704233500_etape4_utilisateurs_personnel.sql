-- Étape 4 — Utilisateurs & Personnel (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 6
-- Migration additive uniquement.

-- ============================================================================
-- T1 — personnel_structures (détail RH 1:1 sur membres_organisations)
-- ============================================================================
create table if not exists public.personnel_structures (
  id uuid primary key default gen_random_uuid(),
  membre_organisation_id uuid not null unique references public.membres_organisations(id) on delete cascade,
  poste text,
  date_embauche date,
  statut text not null default 'actif' check (statut in ('actif','inactif','suspendu')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T2 — invitations_utilisateurs
-- ============================================================================
create table if not exists public.invitations_utilisateurs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role_propose text not null check (role_propose in (
    'fondateur','super_admin_client','administrateur','directeur','coordinateur','educateur',
    'formateur','enseignant','coach','consultant','psychologue','assistant_social',
    'beneficiaire','parent','tuteur','mentor','employeur','recruteur','partenaire'
  )),
  statut text not null default 'en_attente' check (statut in ('en_attente','acceptee','refusee','expiree')),
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  invite_par uuid references public.profiles(id),
  expire_le timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T3 — affectations_personnel (pointeur polymorphe : cibles futures : classes,
-- bénéficiaires, programmes — n'existent pas encore, cf. DECISIONS_LOG.md)
-- ============================================================================
create table if not exists public.affectations_personnel (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  membre_organisation_id uuid not null references public.membres_organisations(id) on delete cascade,
  cible_type text,
  cible_id uuid,
  fonction text,
  date_debut date not null default current_date,
  date_fin date,
  statut text not null default 'active' check (statut in ('active','terminee')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T4 — sessions_connexion
-- ============================================================================
create table if not exists public.sessions_connexion (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ip_adresse inet,
  user_agent text,
  connecte_le timestamptz not null default now(),
  deconnecte_le timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- T5 — index, triggers, seed permissions
-- ============================================================================
create index if not exists idx_personnel_structures_membre_organisation_id on public.personnel_structures(membre_organisation_id);
create index if not exists idx_invitations_utilisateurs_organisation_id on public.invitations_utilisateurs(organisation_id);
create index if not exists idx_invitations_utilisateurs_invite_par on public.invitations_utilisateurs(invite_par);
create index if not exists idx_affectations_personnel_organisation_id on public.affectations_personnel(organisation_id);
create index if not exists idx_affectations_personnel_membre_organisation_id on public.affectations_personnel(membre_organisation_id);
create index if not exists idx_affectations_personnel_cible on public.affectations_personnel(cible_type, cible_id);
create index if not exists idx_sessions_connexion_organisation_id on public.sessions_connexion(organisation_id);
create index if not exists idx_sessions_connexion_profile_id on public.sessions_connexion(profile_id);

create trigger set_updated_at before update on public.personnel_structures
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.invitations_utilisateurs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.affectations_personnel
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.sessions_connexion
  for each row execute function public.set_updated_at();

create trigger audit_personnel_structures after insert or update or delete on public.personnel_structures
  for each row execute function public.log_audit();
create trigger audit_invitations_utilisateurs after insert or update or delete on public.invitations_utilisateurs
  for each row execute function public.log_audit();
create trigger audit_affectations_personnel after insert or update or delete on public.affectations_personnel
  for each row execute function public.log_audit();
-- pas de trigger d'audit sur sessions_connexion : une connexion n'a pas de notion d'"avant/après" à tracer,
-- l'historique des connexions EST déjà la trace (chaque ligne = un événement).

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','personnel_structures', true, true, true, true),
  ('fondateur','invitations_utilisateurs', true, true, true, true),
  ('fondateur','affectations_personnel', true, true, true, true),
  ('fondateur','sessions_connexion', true, true, false, false),
  ('administrateur','personnel_structures', true, true, true, false),
  ('administrateur','invitations_utilisateurs', true, true, true, false),
  ('administrateur','affectations_personnel', true, true, true, false),
  ('administrateur','sessions_connexion', true, false, false, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.personnel_structures enable row level security;
alter table public.invitations_utilisateurs enable row level security;
alter table public.affectations_personnel enable row level security;
alter table public.sessions_connexion enable row level security;

-- personnel_structures : scoping via l'organisation du membre concerné
create policy personnel_structures_select on public.personnel_structures
  for select using (
    public.is_fondateur() or exists (
      select 1 from public.membres_organisations mo
      where mo.id = personnel_structures.membre_organisation_id
        and public.est_membre_organisation(mo.organisation_id)
    )
  );
create policy personnel_structures_insert on public.personnel_structures
  for insert with check (
    public.is_fondateur() or exists (
      select 1 from public.membres_organisations mo
      where mo.id = membre_organisation_id and public.peut_creer('personnel_structures', mo.organisation_id)
    )
  );
create policy personnel_structures_update on public.personnel_structures
  for update using (
    public.is_fondateur() or exists (
      select 1 from public.membres_organisations mo
      where mo.id = personnel_structures.membre_organisation_id and public.peut_modifier('personnel_structures', mo.organisation_id)
    )
  );
create policy personnel_structures_delete on public.personnel_structures
  for delete using (
    public.is_fondateur() or exists (
      select 1 from public.membres_organisations mo
      where mo.id = personnel_structures.membre_organisation_id and public.peut_supprimer('personnel_structures', mo.organisation_id)
    )
  );

-- invitations_utilisateurs : scoping direct par organisation_id
create policy invitations_utilisateurs_select on public.invitations_utilisateurs
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
create policy invitations_utilisateurs_insert on public.invitations_utilisateurs
  for insert with check (public.is_fondateur() or public.peut_creer('invitations_utilisateurs', organisation_id));
create policy invitations_utilisateurs_update on public.invitations_utilisateurs
  for update using (public.is_fondateur() or public.peut_modifier('invitations_utilisateurs', organisation_id));
create policy invitations_utilisateurs_delete on public.invitations_utilisateurs
  for delete using (public.is_fondateur() or public.peut_supprimer('invitations_utilisateurs', organisation_id));

-- affectations_personnel : scoping direct par organisation_id
create policy affectations_personnel_select on public.affectations_personnel
  for select using (public.is_fondateur() or public.est_membre_organisation(organisation_id));
create policy affectations_personnel_insert on public.affectations_personnel
  for insert with check (public.is_fondateur() or public.peut_creer('affectations_personnel', organisation_id));
create policy affectations_personnel_update on public.affectations_personnel
  for update using (public.is_fondateur() or public.peut_modifier('affectations_personnel', organisation_id));
create policy affectations_personnel_delete on public.affectations_personnel
  for delete using (public.is_fondateur() or public.peut_supprimer('affectations_personnel', organisation_id));

-- sessions_connexion : chacun voit ses propres sessions ; fondateur/admin voient celles de leur organisation
create policy sessions_connexion_select on public.sessions_connexion
  for select using (
    auth.uid() = profile_id
    or public.is_fondateur()
    or (organisation_id is not null and public.peut_lire('sessions_connexion', organisation_id))
  );
create policy sessions_connexion_insert on public.sessions_connexion
  for insert with check (auth.uid() = profile_id or public.is_fondateur());
create policy sessions_connexion_update on public.sessions_connexion
  for update using (auth.uid() = profile_id or public.is_fondateur());
