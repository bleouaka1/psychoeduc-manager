-- Publication automatique des formations + badge de vérification — ÉTAPE 3/3 (UI),
-- compléments de schéma nécessaires : exposer le statut et la formation liée dans la
-- vue publique (pour le badge et la page détail), bucket public pour les photos de
-- profil formateur. Migration additive uniquement.

-- ============================================================================
-- T1 — vue_marketplace_publique : ajout de `statut` (pour le badge "en vérification")
-- et `formation_id` (pour lier systématiquement vers la fiche formation, que la
-- ligne vienne de `formations` directement ou de `marketplace_offres`). Colonnes
-- ajoutées en fin de liste (contrainte Postgres sur CREATE OR REPLACE VIEW).
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
  f.created_at,
  o.created_at as organisation_created_at,
  'publiee'::text as statut,
  f.id as formation_id
from public.formations f
join public.organisations o on o.id = f.organisation_id
where f.statut = 'publiee'
  and not exists (select 1 from public.marketplace_offres mo2 where mo2.formation_id = f.id)
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
  mo.created_at,
  o.created_at as organisation_created_at,
  mo.statut,
  mo.formation_id
from public.marketplace_offres mo
join public.organisations o on o.id = mo.organisation_id
where mo.statut in ('publiee','visible_en_verification');

-- ============================================================================
-- T2 — bucket Storage public pour les photos de profil formateur (recadrage carré
-- appliqué côté client avant l'upload, cf. étape UI). Public en lecture (photo de
-- profil = donnée déjà destinée à être publique sur la marketplace), écriture
-- restreinte au propriétaire de l'organisation.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('photos-profil', 'photos-profil', true)
on conflict (id) do nothing;

-- convention de chemin : <organisation_id>/<fichier>. Même module de permission que
-- la table profils_publics_formateurs elle-même ('formations', déjà seedé pour
-- administrateur depuis l'Étape 8) — pas de nouveau module inventé pour rester
-- cohérent avec la policy déjà en place sur la table.
drop policy if exists photos_profil_storage_insert on storage.objects;
create policy photos_profil_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'photos-profil'
    and (public.is_fondateur() or public.peut_creer('formations', ((storage.foldername(name))[1])::uuid))
  );

drop policy if exists photos_profil_storage_update on storage.objects;
create policy photos_profil_storage_update on storage.objects
  for update using (
    bucket_id = 'photos-profil'
    and (public.is_fondateur() or public.peut_modifier('formations', ((storage.foldername(name))[1])::uuid))
  );

drop policy if exists photos_profil_storage_delete on storage.objects;
create policy photos_profil_storage_delete on storage.objects
  for delete using (
    bucket_id = 'photos-profil'
    and (public.is_fondateur() or public.peut_modifier('formations', ((storage.foldername(name))[1])::uuid))
  );
