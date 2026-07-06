-- Publication automatique des formations dans la Marketplace — ÉTAPE 2/3 (logique
-- de création automatique, implémentée en TypeScript : cf. lib/marketplaceAutoPublish.ts
-- et app/solo/formations/actions.ts). Cette migration ne contient AUCUN trigger de
-- création — conformément à la préférence explicite pour du TypeScript standard,
-- seule la vue publique est corrigée pour éviter une double exposition.
--
-- Sans ce correctif, une formation qui obtient désormais une ligne marketplace_offres
-- liée (formation_id) dès sa création apparaîtrait DEUX FOIS dans la marketplace
-- publique dès que la formation elle-même passe à statut='publiee' : une fois via
-- la branche "formations" de la vue, une fois via la branche "marketplace_offres".
-- Exclusion additive : les formations déjà représentées par leur propre ligne
-- marketplace_offres (formation_id) ne sont plus lues directement depuis `formations`.

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
  o.created_at as organisation_created_at
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
  o.created_at as organisation_created_at
from public.marketplace_offres mo
join public.organisations o on o.id = mo.organisation_id
where mo.statut in ('publiee','visible_en_verification');

-- Même correctif sur l'aperçu marketplace du tableau de bord Compte Solo.
create or replace view public.vue_marketplace_formations
with (security_invoker = true) as
select f.id, f.titre, f.description, f.mode_transmission, f.prix, f.devise, f.duree_heures,
       f.organisation_id, o.nom as organisation_nom, o.type_organisation,
       exists(select 1 from public.roles_utilisateurs ru join public.membres_organisations mo on mo.id = ru.membre_organisation_id
              where mo.organisation_id = f.organisation_id and ru.role = 'fondateur' and ru.actif) as vendeur_est_fondateur
from public.formations f
join public.organisations o on o.id = f.organisation_id
where f.statut = 'publiee'
  and not exists (select 1 from public.marketplace_offres mo2 where mo2.formation_id = f.id);
