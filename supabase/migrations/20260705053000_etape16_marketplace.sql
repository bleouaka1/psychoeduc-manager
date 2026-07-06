-- Étape 16 — Marketplace (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 18
-- Migration additive uniquement.

-- ============================================================================
-- T1 — parametres_plateforme (version minimale, anticipee sur l'Etape 25)
-- ============================================================================
create table if not exists public.parametres_plateforme (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,
  valeur jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.parametres_plateforme (cle, valeur, description)
values ('taux_commission_marketplace', '0.15', 'Taux de commission plateforme sur les ventes marketplace et evenements payants')
on conflict (cle) do nothing;

create or replace function public.get_parametre_numerique(p_cle text, p_defaut numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select valeur::text::numeric from public.parametres_plateforme where cle = p_cle), p_defaut);
$$;

create trigger set_updated_at before update on public.parametres_plateforme for each row execute function public.set_updated_at();

-- ============================================================================
-- T2 — marketplace_categories, marketplace_offres
-- ============================================================================
create table if not exists public.marketplace_categories (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  type_offre text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_offres (
  id uuid primary key default gen_random_uuid(),
  vendeur_type text check (vendeur_type in ('organisation','solo')),
  vendeur_id uuid,
  type_offre text check (type_offre in ('formation','service','produit')),
  titre text not null,
  description text,
  prix numeric,
  devise text not null default 'FCFA',
  statut text not null default 'en_attente_validation' check (statut in ('en_attente_validation','publiee','refusee','masquee','retiree')),
  valide_par uuid references public.profiles(id),
  date_validation timestamptz,
  nombre_signalements int not null default 0,
  organisation_id uuid references public.organisations(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Toute nouvelle offre entre en_attente_validation, sans exception (meme le fondateur).
-- Seul un passage explicite a 'publiee'/'refusee' par le fondateur est autorise ensuite.
create or replace function public.enforce_marketplace_offre_statut()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    new.statut := 'en_attente_validation';
  elsif TG_OP = 'UPDATE' and new.statut is distinct from old.statut and new.statut in ('publiee','refusee') then
    if not public.is_fondateur() then
      raise exception 'Seul le fondateur peut valider ou refuser une offre marketplace';
    end if;
    new.date_validation := now();
  end if;
  return new;
end;
$$;

create trigger enforce_marketplace_offre_statut before insert or update on public.marketplace_offres
  for each row execute function public.enforce_marketplace_offre_statut();

-- ============================================================================
-- T3 — marketplace_commandes (append-only), marketplace_avis, marketplace_signalements
-- ============================================================================
create table if not exists public.marketplace_commandes (
  id uuid primary key default gen_random_uuid(),
  offre_id uuid not null references public.marketplace_offres(id) on delete cascade,
  acheteur_id uuid references public.profiles(id),
  montant_brut numeric not null,
  taux_commission numeric not null default public.get_parametre_numerique('taux_commission_marketplace', 0.15),
  montant_commission numeric,
  montant_vendeur numeric,
  statut_paiement text not null default 'initie' check (statut_paiement in ('initie','confirme','echoue','rembourse')),
  mouvement_financier_id uuid references public.mouvements_financiers(id),
  date_commande timestamptz not null default now(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_avis (
  id uuid primary key default gen_random_uuid(),
  offre_id uuid not null references public.marketplace_offres(id) on delete cascade,
  acheteur_id uuid references public.profiles(id),
  note int check (note between 1 and 5),
  commentaire text,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_signalements (
  id uuid primary key default gen_random_uuid(),
  offre_id uuid not null references public.marketplace_offres(id) on delete cascade,
  signale_par uuid references public.profiles(id),
  motif text,
  statut text not null default 'en_attente' check (statut in ('en_attente','traite')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.marketplace_categories for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.marketplace_signalements for each row execute function public.set_updated_at();

-- ============================================================================
-- T4 — masquage automatique au seuil de signalements (seuil = 3, ajustable plus
-- tard via parametres_plateforme sans migration destructive)
-- ============================================================================
create or replace function public.handle_new_signalement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seuil numeric := public.get_parametre_numerique('seuil_signalements_masquage', 3);
  v_total int;
begin
  update public.marketplace_offres
  set nombre_signalements = nombre_signalements + 1
  where id = new.offre_id
  returning nombre_signalements into v_total;

  if v_total >= v_seuil then
    update public.marketplace_offres set statut = 'masquee' where id = new.offre_id and statut = 'publiee';
  end if;

  return new;
end;
$$;

create trigger on_new_signalement after insert on public.marketplace_signalements
  for each row execute function public.handle_new_signalement();

-- ============================================================================
-- Index, seed permissions
-- ============================================================================
create index if not exists idx_marketplace_offres_organisation_id on public.marketplace_offres(organisation_id);
create index if not exists idx_marketplace_offres_vendeur_id on public.marketplace_offres(vendeur_id);
create index if not exists idx_marketplace_commandes_offre_id on public.marketplace_commandes(offre_id);
create index if not exists idx_marketplace_avis_offre_id on public.marketplace_avis(offre_id);
create index if not exists idx_marketplace_signalements_offre_id on public.marketplace_signalements(offre_id);

create trigger audit_marketplace_offres after insert or update or delete on public.marketplace_offres for each row execute function public.log_audit();

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','parametres_plateforme', true, true, true, true),
  ('fondateur','marketplace_categories', true, true, true, true),
  ('fondateur','marketplace_offres', true, true, true, true),
  ('fondateur','marketplace_commandes', true, true, false, false),
  ('fondateur','marketplace_avis', true, true, true, true),
  ('fondateur','marketplace_signalements', true, true, true, true),
  ('administrateur','marketplace_offres', true, true, true, false),
  ('administrateur','marketplace_signalements', true, false, true, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.parametres_plateforme enable row level security;
alter table public.marketplace_categories enable row level security;
alter table public.marketplace_offres enable row level security;
alter table public.marketplace_commandes enable row level security;
alter table public.marketplace_avis enable row level security;
alter table public.marketplace_signalements enable row level security;

create policy parametres_plateforme_select on public.parametres_plateforme for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy parametres_plateforme_write on public.parametres_plateforme for all using (public.is_fondateur()) with check (public.is_fondateur());

create policy marketplace_categories_select on public.marketplace_categories for select using (auth.role() = 'authenticated' or public.is_fondateur());
create policy marketplace_categories_write on public.marketplace_categories for all using (public.is_fondateur()) with check (public.is_fondateur());

-- marketplace_offres : publiee = visible a tous ; sinon reserve au vendeur, a l'org, ou au fondateur
create policy marketplace_offres_select on public.marketplace_offres
  for select using (
    statut = 'publiee'
    or public.is_fondateur()
    or vendeur_id = auth.uid()
    or (organisation_id is not null and public.peut_lire('marketplace_offres', organisation_id))
  );
create policy marketplace_offres_insert on public.marketplace_offres
  for insert with check (
    public.is_fondateur()
    or vendeur_id = auth.uid()
    or (organisation_id is not null and public.peut_creer('marketplace_offres', organisation_id))
  );
create policy marketplace_offres_update on public.marketplace_offres
  for update using (
    public.is_fondateur()
    or vendeur_id = auth.uid()
    or (organisation_id is not null and public.peut_modifier('marketplace_offres', organisation_id))
  );
create policy marketplace_offres_delete on public.marketplace_offres
  for delete using (public.is_fondateur() or vendeur_id = auth.uid());

-- marketplace_commandes : append-only, visible acheteur/vendeur/fondateur
create policy marketplace_commandes_select on public.marketplace_commandes
  for select using (
    public.is_fondateur()
    or acheteur_id = auth.uid()
    or exists (select 1 from public.marketplace_offres o where o.id = marketplace_commandes.offre_id and o.vendeur_id = auth.uid())
    or (organisation_id is not null and public.peut_lire('marketplace_commandes', organisation_id))
  );
create policy marketplace_commandes_insert on public.marketplace_commandes
  for insert with check (public.is_fondateur() or acheteur_id = auth.uid());

-- marketplace_avis : lecture publique (avis visibles), ecriture par l'acheteur
create policy marketplace_avis_select on public.marketplace_avis for select using (visible = true or public.is_fondateur());
create policy marketplace_avis_insert on public.marketplace_avis for insert with check (public.is_fondateur() or acheteur_id = auth.uid());
create policy marketplace_avis_update on public.marketplace_avis for update using (public.is_fondateur());

-- marketplace_signalements : n'importe quel authentifie peut signaler, traitement reserve au fondateur/admin
create policy marketplace_signalements_select on public.marketplace_signalements for select using (public.is_fondateur() or signale_par = auth.uid());
create policy marketplace_signalements_insert on public.marketplace_signalements for insert with check (auth.role() = 'authenticated');
create policy marketplace_signalements_update on public.marketplace_signalements for update using (public.is_fondateur());
