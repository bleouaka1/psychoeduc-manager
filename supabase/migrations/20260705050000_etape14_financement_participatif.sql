-- Étape 14 — Financement participatif (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 16
-- Construite après l'Étape 15 (mouvements_financiers doit exister). Migration additive uniquement.

create table if not exists public.projets_financement (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  titre text not null,
  description text,
  montant_cible numeric not null,
  date_debut date not null default current_date,
  date_fin date,
  statut text not null default 'en_cours' check (statut in ('en_cours','finance','cloture','annule')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preuves_utilisation_fonds (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets_financement(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  description text,
  url_fichier text,
  montant_justifie numeric,
  date_soumission date not null default current_date,
  valide boolean not null default false,
  valide_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rapports_financement (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets_financement(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  contenu text,
  periode_debut date,
  periode_fin date,
  redige_par uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- append-only strict (mouvements d'argent reels)
create table if not exists public.contributions_financement (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets_financement(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  contributeur_id uuid references public.profiles(id),
  contributeur_nom text,
  montant numeric not null,
  devise text not null default 'FCFA',
  statut text not null default 'initie' check (statut in ('initie','confirme','echoue','rembourse')),
  mouvement_financier_id uuid references public.mouvements_financiers(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.commissions_financement (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions_financement(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  taux_commission numeric,
  montant_commission numeric,
  mouvement_financier_id uuid references public.mouvements_financiers(id),
  created_at timestamptz not null default now()
);

create table if not exists public.retraits_financement (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets_financement(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  montant numeric not null,
  statut text not null default 'demande' check (statut in ('demande','traite','rejete')),
  mouvement_financier_id uuid references public.mouvements_financiers(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- wallets_beneficiaires : vue, jamais un solde stocke en dur
create or replace view public.wallets_beneficiaires
with (security_invoker = true) as
select
  beneficiaire_id,
  organisation_id,
  coalesce(sum(montant), 0) as solde
from public.mouvements_financiers
where beneficiaire_id is not null and statut = 'confirme'
group by beneficiaire_id, organisation_id;

-- vue_soldes_actuels : panorama unifie fondateur + tous les beneficiaires
create or replace view public.vue_soldes_actuels
with (security_invoker = true) as
select 'fondateur'::text as type_solde, null::uuid as beneficiaire_id, null::uuid as organisation_id, solde
from public.wallet_fondateur
union all
select 'beneficiaire'::text as type_solde, beneficiaire_id, organisation_id, solde
from public.wallets_beneficiaires;

-- index
create index if not exists idx_projets_financement_beneficiaire_id on public.projets_financement(beneficiaire_id);
create index if not exists idx_projets_financement_organisation_id on public.projets_financement(organisation_id);
create index if not exists idx_preuves_utilisation_fonds_projet_id on public.preuves_utilisation_fonds(projet_id);
create index if not exists idx_rapports_financement_projet_id on public.rapports_financement(projet_id);
create index if not exists idx_contributions_financement_projet_id on public.contributions_financement(projet_id);
create index if not exists idx_commissions_financement_contribution_id on public.commissions_financement(contribution_id);
create index if not exists idx_retraits_financement_projet_id on public.retraits_financement(projet_id);
create index if not exists idx_retraits_financement_beneficiaire_id on public.retraits_financement(beneficiaire_id);

-- triggers (tables mutables uniquement, pas les 3 tables append-only)
create trigger set_updated_at before update on public.projets_financement for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.preuves_utilisation_fonds for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rapports_financement for each row execute function public.set_updated_at();

create trigger audit_projets_financement after insert or update or delete on public.projets_financement for each row execute function public.log_audit();
create trigger audit_contributions_financement after insert or update or delete on public.contributions_financement for each row execute function public.log_audit();
create trigger audit_retraits_financement after insert or update or delete on public.retraits_financement for each row execute function public.log_audit();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','projets_financement', true, true, true, true),
  ('fondateur','preuves_utilisation_fonds', true, true, true, true),
  ('fondateur','rapports_financement', true, true, true, true),
  ('fondateur','contributions_financement', true, true, false, false),
  ('fondateur','commissions_financement', true, true, false, false),
  ('fondateur','retraits_financement', true, true, false, false),
  ('administrateur','projets_financement', true, true, true, false),
  ('administrateur','retraits_financement', true, true, false, false),
  ('coordinateur','projets_financement', true, true, true, false),
  ('assistant_social','projets_financement', true, true, true, false),
  ('assistant_social','preuves_utilisation_fonds', true, true, true, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.projets_financement enable row level security;
alter table public.preuves_utilisation_fonds enable row level security;
alter table public.rapports_financement enable row level security;
alter table public.contributions_financement enable row level security;
alter table public.commissions_financement enable row level security;
alter table public.retraits_financement enable row level security;

create policy projets_financement_select on public.projets_financement for select using (public.is_fondateur() or public.peut_lire('projets_financement', organisation_id));
create policy projets_financement_insert on public.projets_financement for insert with check (public.is_fondateur() or public.peut_creer('projets_financement', organisation_id));
create policy projets_financement_update on public.projets_financement for update using (public.is_fondateur() or public.peut_modifier('projets_financement', organisation_id));
create policy projets_financement_delete on public.projets_financement for delete using (public.is_fondateur() or public.peut_supprimer('projets_financement', organisation_id));

create policy preuves_utilisation_fonds_select on public.preuves_utilisation_fonds for select using (public.is_fondateur() or public.peut_lire('preuves_utilisation_fonds', organisation_id));
create policy preuves_utilisation_fonds_insert on public.preuves_utilisation_fonds for insert with check (public.is_fondateur() or public.peut_creer('preuves_utilisation_fonds', organisation_id));
create policy preuves_utilisation_fonds_update on public.preuves_utilisation_fonds for update using (public.is_fondateur() or public.peut_modifier('preuves_utilisation_fonds', organisation_id));
create policy preuves_utilisation_fonds_delete on public.preuves_utilisation_fonds for delete using (public.is_fondateur() or public.peut_supprimer('preuves_utilisation_fonds', organisation_id));

create policy rapports_financement_select on public.rapports_financement for select using (public.is_fondateur() or public.peut_lire('rapports_financement', organisation_id));
create policy rapports_financement_insert on public.rapports_financement for insert with check (public.is_fondateur() or public.peut_creer('rapports_financement', organisation_id));
create policy rapports_financement_update on public.rapports_financement for update using (public.is_fondateur() or public.peut_modifier('rapports_financement', organisation_id));
create policy rapports_financement_delete on public.rapports_financement for delete using (public.is_fondateur() or public.peut_supprimer('rapports_financement', organisation_id));

-- append-only strict : select + insert uniquement
create policy contributions_financement_select on public.contributions_financement for select using (public.is_fondateur() or public.peut_lire('contributions_financement', organisation_id));
create policy contributions_financement_insert on public.contributions_financement for insert with check (public.is_fondateur() or public.peut_creer('contributions_financement', organisation_id));

create policy commissions_financement_select on public.commissions_financement for select using (public.is_fondateur() or public.peut_lire('commissions_financement', organisation_id));
create policy commissions_financement_insert on public.commissions_financement for insert with check (public.is_fondateur() or public.peut_creer('commissions_financement', organisation_id));

create policy retraits_financement_select on public.retraits_financement for select using (public.is_fondateur() or public.peut_lire('retraits_financement', organisation_id));
create policy retraits_financement_insert on public.retraits_financement for insert with check (public.is_fondateur() or public.peut_creer('retraits_financement', organisation_id));
