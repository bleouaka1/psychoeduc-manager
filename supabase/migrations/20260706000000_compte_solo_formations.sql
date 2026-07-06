-- Module "Compte Solo" (gabarit générique) — architecture v5 complémentaire
-- Réf : CONSIGNES-COMPTE-SOLO.md. Réutilise l'existant plutôt que de dupliquer :
-- beneficiaires.organisation_id et formations.organisation_id scopent déjà
-- nativement un compte Solo (organisation.type_organisation='solo'), aucune
-- colonne compte_solo_id n'est nécessaire. Migration additive uniquement.

-- ============================================================================
-- Extension de formations (Étape 8) : mode de transmission, prix, statut suspendue
-- ============================================================================
alter table public.formations
  add column if not exists mode_transmission text check (mode_transmission in ('presentiel','video_tutoriel','mixte','autre')),
  add column if not exists prix numeric,
  add column if not exists devise text not null default 'FCFA';

alter table public.formations drop constraint if exists formations_statut_check;
alter table public.formations add constraint formations_statut_check
  check (statut in ('brouillon','publiee','suspendue','archivee'));

-- Marketplace publique = vue filtrée de formations (statut='publiee'), pas de table separee
-- (cf. CONSIGNES-COMPTE-SOLO.md section 5). Visible a tout authentifie, en plus du RLS
-- organisation-scope deja en place pour la gestion privee du formateur.
drop policy if exists formations_select_publique on public.formations;
create policy formations_select_publique on public.formations
  for select using (statut = 'publiee');

create or replace view public.vue_marketplace_formations
with (security_invoker = true) as
select f.id, f.titre, f.description, f.mode_transmission, f.prix, f.devise, f.duree_heures,
       f.organisation_id, o.nom as organisation_nom, o.type_organisation,
       exists(select 1 from public.roles_utilisateurs ru join public.membres_organisations mo on mo.id = ru.membre_organisation_id
              where mo.organisation_id = f.organisation_id and ru.role = 'fondateur' and ru.actif) as vendeur_est_fondateur
from public.formations f
join public.organisations o on o.id = f.organisation_id
where f.statut = 'publiee';

-- ============================================================================
-- inscriptions_formations : un acheteur (n'importe quel profil) s'inscrit a une formation
-- ============================================================================
create table if not exists public.inscriptions_formations (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  acheteur_id uuid not null references public.profiles(id),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  statut text not null default 'en_cours' check (statut in ('en_cours','termine','abandonne')),
  date_inscription timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (formation_id, acheteur_id)
);

-- ============================================================================
-- progression_formation : reutilise la table cours (Etape 8) deja liee a formations
-- ============================================================================
create table if not exists public.progression_formation (
  id uuid primary key default gen_random_uuid(),
  inscription_id uuid not null references public.inscriptions_formations(id) on delete cascade,
  cours_id uuid not null references public.cours(id) on delete cascade,
  complete boolean not null default false,
  date_completion timestamptz,
  created_at timestamptz not null default now(),
  unique (inscription_id, cours_id)
);

-- Vue de progression (pourcentage calcule, jamais stocke en dur)
create or replace view public.vue_progression_formations
with (security_invoker = true) as
select
  i.id as inscription_id,
  i.formation_id,
  i.acheteur_id,
  i.organisation_id,
  count(c.id) as total_cours,
  count(p.id) filter (where p.complete) as cours_completes,
  case when count(c.id) = 0 then 0
       else round(100.0 * count(p.id) filter (where p.complete) / count(c.id))
  end as pourcentage
from public.inscriptions_formations i
join public.cours c on c.formation_id = i.formation_id
left join public.progression_formation p on p.inscription_id = i.id and p.cours_id = c.id
group by i.id, i.formation_id, i.acheteur_id, i.organisation_id;

-- ============================================================================
-- certificats : delivrance automatique a 100% de progression (trigger ci-dessous)
-- ============================================================================
create table if not exists public.certificats (
  id uuid primary key default gen_random_uuid(),
  inscription_id uuid not null unique references public.inscriptions_formations(id) on delete cascade,
  numero_certificat text not null unique default ('CERT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  date_delivrance timestamptz not null default now(),
  url_pdf text,
  created_at timestamptz not null default now()
);

-- Quand une progression atteint 100% des cours de la formation, l'inscription passe
-- 'termine' et un certificat est cree automatiquement s'il n'existe pas deja.
create or replace function public.check_completion_formation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_completes int;
begin
  select count(*) into v_total from public.cours where formation_id = (
    select formation_id from public.inscriptions_formations where id = new.inscription_id
  );
  select count(*) into v_completes from public.progression_formation
    where inscription_id = new.inscription_id and complete = true;

  if v_total > 0 and v_completes >= v_total then
    update public.inscriptions_formations set statut = 'termine' where id = new.inscription_id and statut <> 'termine';
    insert into public.certificats (inscription_id)
      values (new.inscription_id)
      on conflict (inscription_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_progression_check_completion
  after insert or update on public.progression_formation
  for each row execute function public.check_completion_formation();

-- ============================================================================
-- paiements_formation : append-only. AUCUN prestataire de paiement n'est integre
-- dans l'application a ce jour (verifie : aucun SDK/API de paiement dans le code,
-- 'methode_paiement' des tables paiements/marketplace_commandes est un champ texte
-- libre, jamais relie a un vrai checkout). Schema pret pour une integration future,
-- signale explicitement plutot que d'improviser un choix de prestataire.
-- ============================================================================
create table if not exists public.paiements_formation (
  id uuid primary key default gen_random_uuid(),
  inscription_id uuid not null references public.inscriptions_formations(id) on delete cascade,
  montant numeric not null,
  devise text not null default 'FCFA',
  statut text not null check (statut in ('initie','confirme','echoue','rembourse')),
  mouvement_financier_id uuid references public.mouvements_financiers(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Index, triggers, seed permissions
-- ============================================================================
create index if not exists idx_inscriptions_formations_formation_id on public.inscriptions_formations(formation_id);
create index if not exists idx_inscriptions_formations_acheteur_id on public.inscriptions_formations(acheteur_id);
create index if not exists idx_inscriptions_formations_organisation_id on public.inscriptions_formations(organisation_id);
create index if not exists idx_progression_formation_inscription_id on public.progression_formation(inscription_id);
create index if not exists idx_certificats_inscription_id on public.certificats(inscription_id);
create index if not exists idx_paiements_formation_inscription_id on public.paiements_formation(inscription_id);

create trigger set_updated_at before update on public.inscriptions_formations
  for each row execute function public.set_updated_at();

create trigger audit_inscriptions_formations after insert or update or delete on public.inscriptions_formations
  for each row execute function public.log_audit();

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','inscriptions_formations', true, true, true, true),
  ('fondateur','progression_formation', true, true, true, true),
  ('fondateur','certificats', true, true, false, false),
  ('fondateur','paiements_formation', true, true, false, false),
  ('formateur','inscriptions_formations', true, false, true, false),
  ('formateur','progression_formation', true, true, true, false),
  ('formateur','certificats', true, false, false, false),
  ('coach','inscriptions_formations', true, false, true, false),
  ('coach','progression_formation', true, true, true, false),
  ('consultant','inscriptions_formations', true, false, true, false),
  ('enseignant','inscriptions_formations', true, false, true, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.inscriptions_formations enable row level security;
alter table public.progression_formation enable row level security;
alter table public.certificats enable row level security;
alter table public.paiements_formation enable row level security;

-- inscriptions_formations : le vendeur (staff de l'organisation) OU l'acheteur lui-meme
create policy inscriptions_formations_select on public.inscriptions_formations
  for select using (
    public.is_fondateur()
    or acheteur_id = auth.uid()
    or public.peut_lire('inscriptions_formations', organisation_id)
  );
create policy inscriptions_formations_insert on public.inscriptions_formations
  for insert with check (public.is_fondateur() or acheteur_id = auth.uid());
create policy inscriptions_formations_update on public.inscriptions_formations
  for update using (
    public.is_fondateur()
    or acheteur_id = auth.uid()
    or public.peut_modifier('inscriptions_formations', organisation_id)
  );

-- progression_formation : via l'inscription (vendeur ou acheteur)
create policy progression_formation_select on public.progression_formation
  for select using (
    public.is_fondateur()
    or exists (
      select 1 from public.inscriptions_formations i
      where i.id = progression_formation.inscription_id
        and (i.acheteur_id = auth.uid() or public.peut_lire('progression_formation', i.organisation_id))
    )
  );
create policy progression_formation_insert on public.progression_formation
  for insert with check (
    public.is_fondateur()
    or exists (
      select 1 from public.inscriptions_formations i
      where i.id = inscription_id
        and (i.acheteur_id = auth.uid() or public.peut_creer('progression_formation', i.organisation_id))
    )
  );
create policy progression_formation_update on public.progression_formation
  for update using (
    public.is_fondateur()
    or exists (
      select 1 from public.inscriptions_formations i
      where i.id = progression_formation.inscription_id
        and (i.acheteur_id = auth.uid() or public.peut_modifier('progression_formation', i.organisation_id))
    )
  );

-- certificats : l'acheteur titulaire ou le vendeur de la formation
create policy certificats_select on public.certificats
  for select using (
    public.is_fondateur()
    or exists (
      select 1 from public.inscriptions_formations i
      where i.id = certificats.inscription_id
        and (i.acheteur_id = auth.uid() or public.peut_lire('certificats', i.organisation_id))
    )
  );

-- paiements_formation : append-only, meme scoping que inscriptions
create policy paiements_formation_select on public.paiements_formation
  for select using (
    public.is_fondateur()
    or exists (
      select 1 from public.inscriptions_formations i
      where i.id = paiements_formation.inscription_id
        and (i.acheteur_id = auth.uid() or public.peut_lire('paiements_formation', i.organisation_id))
    )
  );
create policy paiements_formation_insert on public.paiements_formation
  for insert with check (
    public.is_fondateur()
    or exists (
      select 1 from public.inscriptions_formations i
      where i.id = inscription_id and (i.acheteur_id = auth.uid() or public.peut_creer('paiements_formation', i.organisation_id))
    )
  );
