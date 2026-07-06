-- Reste de PROMPT-MARKETPLACE-ENGAGEMENT-1.md item 4 : profil vendeur enrichi (taux
-- de satisfaction réel, agrégeant formations ET produits/services — jusqu'ici seule
-- la note des formations était comptée) + mise en avant des nouveaux vendeurs (badge
-- réel basé sur la date de création de l'organisation, jamais une valeur inventée).
-- Migration additive uniquement.

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
where mo.statut = 'publiee';

-- Note de satisfaction globale par organisation vendeuse, agrégeant les DEUX sources
-- d'avis (formations ET marketplace_offres) : jusqu'ici le Profil public ne comptait
-- que les avis de formations, sous-représentant les vendeurs de produits/services.
create or replace view public.vue_satisfaction_vendeur
with (security_invoker = true) as
select organisation_id, round(avg(note)::numeric, 1) as note_moyenne, count(*) as nombre_avis
from (
  select f.organisation_id, a.note
  from public.avis_formations a
  join public.formations f on f.id = a.formation_id
  union all
  select mo.organisation_id, a.note
  from public.marketplace_avis a
  join public.marketplace_offres mo on mo.id = a.offre_id
  where a.visible
) t
group by organisation_id;
