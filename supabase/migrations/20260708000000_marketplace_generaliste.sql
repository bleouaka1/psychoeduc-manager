-- Marketplace généraliste (PROMPT-MARKETPLACE-GENERALISTE.md)
-- Décision structurante documentée dans JOURNAL-AUTONOMIE.md : `marketplace_offres`
-- (Étape 16, déjà générique type_offre in formation/service/produit) existait déjà
-- mais n'était utilisée par aucune UI. Plutôt que fusionner avec `formations` (risque
-- réel, données pédagogiques déjà vivantes : cours/progression/certificats), cette
-- migration étend `marketplace_offres` pour les offres NON pédagogiques (produit/service,
-- aucune donnée existante à casser) et unit les deux sources dans une vue publique.
-- Migration additive uniquement.

-- ============================================================================
-- T1 — extension de marketplace_offres : médias, champs spécifiques par type
-- ============================================================================
alter table public.marketplace_offres
  add column if not exists duree_texte text,
  add column if not exists mode_transmission text check (mode_transmission in ('presentiel','video_tutoriel','mixte','autre')),
  add column if not exists stock_disponible int,
  add column if not exists modalites_livraison text,
  add column if not exists image_couverture_url text,
  add column if not exists images_galerie text[] not null default '{}',
  add column if not exists video_url text;

-- Au moins une image de couverture obligatoire avant publication (évite les cartes
-- marketplace vides). Vérifié dans le même trigger que la validation fondateur existante.
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
    if new.statut = 'publiee' and new.image_couverture_url is null then
      raise exception 'Une image de couverture est obligatoire avant de publier une offre marketplace';
    end if;
    new.date_validation := now();
  end if;
  return new;
end;
$$;

-- Médias sur formations aussi, pour la parité dans la vue publique unifiée (T4).
alter table public.formations
  add column if not exists image_couverture_url text,
  add column if not exists video_url text;

-- ============================================================================
-- T2 — avis vérifiés : marketplace_avis n'exigeait AUCUNE commande réelle avant
-- insertion (trou de confiance réel, cf. PROMPT-MARKETPLACE-ENGAGEMENT-1.md section 2 :
-- "un avis n'est affichable que si l'utilisateur a réellement acheté/suivi l'offre").
-- Corrigé : un avis ne peut être inséré que si une commande confirmée existe déjà.
-- ============================================================================
drop policy if exists marketplace_avis_insert on public.marketplace_avis;
create policy marketplace_avis_insert on public.marketplace_avis
  for insert with check (
    public.is_fondateur()
    or (
      acheteur_id = auth.uid()
      and exists (
        select 1 from public.marketplace_commandes c
        where c.offre_id = marketplace_avis.offre_id and c.acheteur_id = auth.uid() and c.statut_paiement = 'confirme'
      )
    )
  );

-- ============================================================================
-- T3 — favoris (formations ET marketplace_offres) : pointeur polymorphe sans FK
-- stricte, cohérent avec le pattern déjà utilisé ailleurs dans le projet
-- (ex. affectations_personnel.cible_type/cible_id).
-- ============================================================================
create table if not exists public.favoris_marketplace (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  offre_type text not null check (offre_type in ('formation','marketplace_offre')),
  offre_id uuid not null,
  created_at timestamptz not null default now(),
  unique (profile_id, offre_type, offre_id)
);

create index if not exists idx_favoris_marketplace_profile_id on public.favoris_marketplace(profile_id);

alter table public.favoris_marketplace enable row level security;
create policy favoris_marketplace_all on public.favoris_marketplace
  for all using (profile_id = auth.uid() or public.is_fondateur())
  with check (profile_id = auth.uid());

-- ============================================================================
-- T4 — vue publique unifiée : formations publiées (non modérées, comme aujourd'hui)
-- + marketplace_offres publiées (modérées fondateur, comme depuis l'Étape 16).
-- Compteur d'achats réel par offre, jamais inventé (0 = compteur masqué côté UI).
-- ============================================================================
create or replace view public.vue_marketplace_publique
with (security_invoker = true) as
select
  f.id,
  'formation'::text as type_offre,
  f.titre, f.description, f.prix, f.devise, f.duree_texte, f.mode_transmission,
  null::int as stock_disponible, null::text as modalites_livraison,
  f.image_couverture_url, f.video_url,
  f.organisation_id, o.nom as organisation_nom, o.type_organisation,
  exists(select 1 from public.roles_utilisateurs ru join public.membres_organisations mo on mo.id = ru.membre_organisation_id
         where mo.organisation_id = f.organisation_id and ru.role = 'fondateur' and ru.actif) as vendeur_est_fondateur,
  (select coalesce(round(avg(a.note)::numeric, 1), 0) from public.avis_formations a where a.formation_id = f.id) as note_moyenne,
  (select count(*) from public.avis_formations a where a.formation_id = f.id) as nombre_avis,
  (select count(*) from public.inscriptions_formations i where i.formation_id = f.id) as nombre_achats,
  f.created_at
from public.formations f
join public.organisations o on o.id = f.organisation_id
where f.statut = 'publiee'
union all
select
  mo.id,
  mo.type_offre,
  mo.titre, mo.description, mo.prix, mo.devise, mo.duree_texte, mo.mode_transmission,
  mo.stock_disponible, mo.modalites_livraison,
  mo.image_couverture_url, mo.video_url,
  mo.organisation_id, o.nom as organisation_nom, o.type_organisation,
  exists(select 1 from public.roles_utilisateurs ru join public.membres_organisations mo2 on mo2.id = ru.membre_organisation_id
         where mo2.organisation_id = mo.organisation_id and ru.role = 'fondateur' and ru.actif) as vendeur_est_fondateur,
  (select coalesce(round(avg(a.note)::numeric, 1), 0) from public.marketplace_avis a where a.offre_id = mo.id and a.visible) as note_moyenne,
  (select count(*) from public.marketplace_avis a where a.offre_id = mo.id and a.visible) as nombre_avis,
  (select count(*) from public.marketplace_commandes c where c.offre_id = mo.id and c.statut_paiement = 'confirme') as nombre_achats,
  mo.created_at
from public.marketplace_offres mo
join public.organisations o on o.id = mo.organisation_id
where mo.statut = 'publiee';

-- ============================================================================
-- T5 — sAcheterOffre (produit/service) : enregistre une commande, AUCUN prestataire
-- de paiement intégré (même limite déjà documentée pour paiements_formation).
-- Pas de trigger de complétion/certificat ici : produit/service n'ont pas de notion
-- de progression pédagogique, contrairement aux formations.
-- ============================================================================
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('administrateur','marketplace_commandes', true, true, false, false),
  ('administrateur','marketplace_avis', true, true, false, false),
  ('administrateur','favoris_marketplace', true, true, true, true)
on conflict (role, module) do nothing;
